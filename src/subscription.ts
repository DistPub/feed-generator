import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { CreateOp, FirehoseSubscriptionBase, getOpsByType, OperationsByType } from './util/subscription'
import { authorPostNotGoodTopic, getBW, isBot, isNSFW, isNotChineseWebsite, isNotGoodUser, putBW, removeFromDB, signLabel } from './bw'
import { Record } from './lexicon/types/app/bsky/feed/post';
import { getDid, getPostByUri, seq } from './config';
import { delayToSync, getDB } from './dbpool';
import { tokenize, removeUrlsAndMentions, zhTokenSeparator, getTopics } from './topic';
import { Database } from './db';
import { detect } from 'tinyld'

const regex = /^(?=.*\p{Script=Han})(?!.*[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\s\S]*$/us;

function getEmbedImgurls(author: string, embed: any, comeFromSub: boolean) {
  let imgUrls: any = null
  if (embed?.images) {
    const images = embed.images as Array<any>
    const imgLinks = images.map(item => {
      return `https://fatesky-cdn.hukoubook.com/img/feed_thumbnail/plain/${author}/${comeFromSub ? item.image.ref : item.image.ref.$link}`
    })
    imgUrls = imgLinks.join()
  }

  else if (embed?.video) {
    const video = embed.video as any
    imgUrls = `https://fatesky-cdn.hukoubook.com/watch/${author}/${comeFromSub ? video.ref : video.ref.$link }/thumbnail.jpg`
  }

  else if (embed?.external) {
    const external = embed.external as any
    if (external?.thumb) {
      imgUrls = `https://fatesky-cdn.hukoubook.com/img/feed_thumbnail/plain/${author}/${comeFromSub ? external.thumb.ref : external.thumb.ref.$link}`
    }
  }

  return imgUrls
}

export async function getPostImgurls(post: CreateOp<Record>, comeFromSub: boolean = true, isTop: boolean = true) {
  let imgUrls: any = null

  if (post.record?.embed?.record) {
    imgUrls = getEmbedImgurls(post.author, post.record.embed?.media, comeFromSub)

    if (isTop) {
      let record: any = post.record.embed.record
      let uri = record.uri || record.record.uri
      let subPost = await getPostByUri(uri)

      if (subPost) {
        let subImgUrls = await getPostImgurls(subPost, false, false)

        if (subImgUrls) {
          if (imgUrls) {
            imgUrls += `;${subImgUrls}`
          } else {
            imgUrls = subImgUrls
          }
        }
      }
    }
  } else {
    imgUrls = getEmbedImgurls(post.author, post.record?.embed, comeFromSub)
  }

  return imgUrls
}

export async function computeTopic(post: CreateOp<Record>, imgUrls: string | null, db: Database) {
  // text topics
  const topics = getTopics(zhTokenSeparator(tokenize(removeUrlsAndMentions(post.record.text))))
  // text+image topics
  if (imgUrls) {
    const authorImgs = imgUrls.split(';')[0].split(',')
    try {
      const ocrRes = await fetch('http://127.0.0.1:8000/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: authorImgs }),
      });
      const data: any = await ocrRes.json();
      const ocrText = data.text.join(' ').trim()
      if (ocrText.length) {
        const ocrTopics = getTopics(zhTokenSeparator(tokenize(removeUrlsAndMentions(`${post.record.text} ${ocrText}`))))
        topics.push(...ocrTopics)
      }
    } catch (e) {
      console.error('getocrTopics failed:', e);
    }
  }

  if (topics.length) {
    await db
      .insertInto('topic')
      .values(topics.map(topic => {
        return {
          topic,
          uri: post.uri,
          time: Date.now()
        }
      }))
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
  return topics
}

function getTextWithoutLink(record: Record) {
  const facets = record.facets ?? []
  const links = facets.filter(item => {
    const types = item.features.map(feature => feature.$type)
    return types.includes('app.bsky.richtext.facet#link')
  })
  const ignores = links.map(item => item.index)
  let str = record.text
  const len = str.length;
  for (const ignore of ignores) {
    const s = Math.max(0, ignore.byteStart);
    const e = Math.min(len - 1, ignore.byteEnd);
    if (s > e) return str;                 // 非法区间直接返回原串
    str = (
      str.slice(0, s) +                     // 前面不动
      ' '.repeat(e - s + 1) +               // 中间替换成空格
      str.slice(e + 1)                      // 后面不动
    );
  }
  return str
}

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handlePostToDelete(ops: OperationsByType) {
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
  }
  async handlePostToCreate(ops: OperationsByType) {
    let postsToCreate = ops.posts.creates
      .filter((create) => {
        // no reply
        return create.record.reply === undefined
      })
      .filter((create) => {
        // no ref with nothing
        if ((create.record?.embed?.record || create.record?.embed?.external) && (!create.record.embed?.media)) {
          const text: string = getTextWithoutLink(create.record)
          if (text.trim() === '') {
            return false
          }
        }
        return true
      })
      .filter((create) => {
        // check content first
        let content = create.record.text
        if (create.record?.embed?.external) {
          let external = create.record.embed.external as any
          content += external.title + external.description
        }

        let matched = regex.test(content)
        if (matched) {
          return true
        }

        // content not match, check langs
        if (!create.record?.langs) {
          return false
        }

        let langs = create.record.langs as Array<string>
        matched = langs.includes('zh') && !langs.includes('ko') && !langs.includes('ja')

        if (!matched) {
          return false
        }

        // detect content, only accept english or unknown
        const lang = detect(content)
        if (lang === 'en' || lang === '') {
          return true
        }

        return false
      })

    if (!postsToCreate.length) return

    let postsToCreates: any = []
    for (let create of postsToCreate) {
      let bot
      try {
        bot = await isBot(create.author, false)
      } catch(error) {
        // ignore when restore error
        continue
      }

      if (bot !== 1) {
        postsToCreates.push(create)
        continue
      }

      // no external
      if (!create.record?.embed?.external) {
        continue
      }

      let external = create.record.embed.external as any
      const externalContent = external.title + external.description
      let matched = regex.test(externalContent)
      if (!matched) {
        continue
      }

      let url = new URL(external.uri)
      if (await isNotChineseWebsite(url.hostname)) {
        continue
      }

      postsToCreates.push(create)
    }

    if (!postsToCreates.length) return

    const imageCache = {}

    // skip not good topic
    const selectGoodTopic: boolean[] = []
    for (let post of postsToCreates) {
      const imgUrls = await getPostImgurls(post)
      imageCache[post.uri] = imgUrls
      const topics = await computeTopic(post, imgUrls, this.db)

      let selectPost = true
      if (topics.length) {
        if (await authorPostNotGoodTopic(post.author, topics)) {
          selectPost = false
          let ret = await getBW(post.author)
          ret.bot = 1
          await putBW([ret])
          await removeFromDB(post.author)
        }
      }
      selectGoodTopic.push(selectPost)
    }
    postsToCreates = postsToCreates.filter((_, i) => selectGoodTopic[i])

    if (!postsToCreates.length) return

    // check not good user
    for (let post of postsToCreates) {
      await isNotGoodUser(post.author, true)
    }

    let modImagePosts: any[] = []
    let createPosts: any[] = []
    for(let post of postsToCreates) {
      let imgUrls = imageCache[post.uri]

      if (imgUrls && !post.record?.labels?.length) {
        let a_nsfw = null
        let b_nsfw = null
        let refAuthor = ''
        let [a, b] = imgUrls.split(';')

        if (a) a_nsfw = await isNSFW(post.author)

          // ref a record
        if (b) {
          let uri = post.record.embed.record.uri || post.record.embed.record.record.uri
          refAuthor = getDid(uri)
          b_nsfw = await isNSFW(refAuthor)
        }

        if (a_nsfw === -1 || b_nsfw === -1) {
          modImagePosts.push({
            uri: post.uri,
            cid: post.cid,
            indexedAt: new Date().toISOString(),
            author: post.author,
            refAuthor,
            imgUrls
          })
          continue
        }
      }

      createPosts.push({
        uri: post.uri,
        cid: post.cid,
        author: post.author,
        indexedAt: new Date().toISOString()
      })
    }

    // log info
    console.log(`[FirehoseSubscription]create ${createPosts.length} posts, mod ${modImagePosts.length} posts`)

    if (modImagePosts.length > 0) {
      await this.db
        .insertInto('mod_image_post')
        .values(modImagePosts)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
    if (createPosts.length > 0) {
      await this.db
        .insertInto('post')
        .values(createPosts)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
  async handleListItemToDelete(ops: OperationsByType) {
    const removed = ops.listitems.deletes.map(item => getDid(item.uri)).filter(item => item == process.env.ADMIN_DID)
    if (removed.length)
      console.log(`admin remove ${removed.length} list item, not-good user label will emit after sync not db.`)
  }
  async handleListItemToCreate(ops: OperationsByType) {
    const created = ops.listitems.creates.filter(item => item.author == process.env.ADMIN_DID)
    if (created.length) {
      console.log(`admin create ${created.length} list item, not-good user label will emit right now.`)
      // not.db will generate */10 minuts, put delay to sync not.db, make sure the sync will use newer version
      delayToSync.time = new Date(Date.now() + 15 * 60000)
      const notGoodUsers = created.map(item => {return {did: item.record.subject}})
      let db = await getDB('not.db', false, false)
      await db
        .insertInto('not_good_user')
        .values(notGoodUsers)
        .onConflict((oc) => oc.doNothing())
        .execute()

      let labels = notGoodUsers.map(item => {
        return {
          uri: item.did,
          val: 'not-good',
          cts: new Date().toISOString()
        }
      })
      labels = labels.map(item => (signLabel({src: process.env.LABELER_DID, ...item})))
      let events = [{ seq: new Date().getTime(), labels}]
      seq.emit('events', events)
    }
  }
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    /////////////////////////////////////////////////////////////////

    if (this.queue.size >= this.maxSize) {
      console.warn(`[queue] skip ${evt.seq}, current size: ${this.queue.size} pending: ${this.queue.pending}`)
      return
    }

    return this.queue.add(async () => {
      const ops = await getOpsByType(evt)
      await this.handleListItemToDelete(ops)
      await this.handleListItemToCreate(ops)
      await this.handlePostToDelete(ops)
      await this.handlePostToCreate(ops)

      // update stored cursor every 20 events or so
      if (evt.seq % 20 === 0) {
        await this.updateCursor(evt.seq)
      }
    })
  }
}
