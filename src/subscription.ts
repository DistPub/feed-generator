import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { CreateOp, FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { isBot, isNSFW, isNotChineseWebsite, isNotGoodUser } from './bw'
import { Record } from './lexicon/types/app/bsky/feed/post';
import { getDid, getPostByUri } from './config';

const regex = /^(?=.*\p{Script=Han})(?!.*[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\s\S]*$/us;

function getEmbedImgurls(author: string, embed: any, comeFromSub: boolean) {
  let imgUrls: any = null
  if (embed?.images) {
    const images = embed.images as Array<any>
    const imgLinks = images.map(item => {
      return `https://cdn.bsky.app/img/feed_thumbnail/plain/${author}/${comeFromSub ? item.image.ref : item.image.ref.$link}`
    })
    imgUrls = imgLinks.join()
  }

  else if (embed?.video) {
    const video = embed.video as any
    imgUrls = `https://video.bsky.app/watch/${author}/${comeFromSub ? video.ref : video.ref.$link }/thumbnail.jpg`
  }

  else if (embed?.external) {
    const external = embed.external as any
    if (external?.thumb) {
      imgUrls = `https://cdn.bsky.app/img/feed_thumbnail/plain/${author}/${comeFromSub ? external.thumb.ref : external.thumb.ref.$link}`
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
      let subImgUrls = await getPostImgurls(subPost, false, false)

      if (subImgUrls) {
        if (imgUrls) {
          imgUrls += `;${subImgUrls}`
        } else {
          imgUrls = subImgUrls
        }
      }
    }
  } else {
    imgUrls = getEmbedImgurls(post.author, post.record?.embed, comeFromSub)
  }

  return imgUrls
}


export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (this.queue.size >= this.maxSize) {
      console.log(`queue is full, skip event: ${evt.seq}`)
      return
    }

    /////////////////////////////////////////////////////////////////
    console.log(`add task to queue ${evt.seq}`)

    return this.queue.add(async () => {
      console.log(`current queue size: ${this.queue.size}`)

    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }

    let postsToCreate = ops.posts.creates
      .filter((create) => {
        // no reply
        return create.record.reply === undefined
      })
      .filter((create) => {
        // no ref with nothing
        if (create.record?.embed?.record)
          if (!create.record.embed?.media && create.record.text === '')
            return false
        return true
      })
      .filter((create) => {
        // langs exists
        if (create.record?.langs) {
          let langs = create.record.langs as Array<string>
          return langs.includes('zh') && !langs.includes('ko') && !langs.includes('ja')
        }

        // no langs set
        return regex.test(create.record.text)
      })

    if (!postsToCreate.length) return

      let postsToCreates: any = []
      for (let create of postsToCreate) {
        let bot = await isBot(create.author)

        if (bot !== 1) {
          postsToCreates.push(create)
          continue
        }

        // no external
        if (!create.record?.embed?.external) {
          continue
        }

        let external = create.record.embed.external as any
        let content = external.title + external.description

        if (!regex.test(content)) {
          continue
        }

        let url = new URL(external.uri)
        if (await isNotChineseWebsite(url.hostname)) {
          continue
        }

        postsToCreates.push(create)
      }

      if (!postsToCreates.length) return

      // check not good user
      for (let post of postsToCreates) {
        await isNotGoodUser(post.author, true)
      }

      let modImagePosts: any[] = []
      let createPosts: any[] = []
      for(let post of postsToCreates) {
        let imgUrls = await getPostImgurls(post)

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

      // update stored cursor every 20 events or so
      if (evt.seq % 20 === 0) {
        await this.updateCursor(evt.seq)
      }
    })
  }
}
