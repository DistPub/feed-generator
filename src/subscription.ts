import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { isBot, isNSFW, isNotChineseWebsite } from './bw'

const regex = /^(?=.*\p{Script=Han})(?!.*[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\s\S]*$/us;

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    let postsToCreate = ops.posts.creates
      .filter((create) => {
        // no reply
        return create.record.reply === undefined
      })
      .filter((create) => {
        // langs exists
        if (create.record?.langs) {
          let langs = create.record.langs as Array<string>
          return langs.includes('zh') && !langs.includes('ko') && !langs.includes('ja')
        }

        // no langs set
        return regex.test(create.record.text)
      }).filter(async (create) => {
        let bot = await isBot(create.author)

        if (bot !== 1) return true

        // no external
        if (!create.record?.embed?.external) {
          return false
        }

        let external = create.record.embed.external as any
        let content = external.title + external.description

        if (!regex.test(content)) {
          return false
        }

        let url = new URL(external.uri)
        return !isNotChineseWebsite(url.hostname)
      })

    let modImagePosts: any[] = []
    let createPosts: any[] = []
    for(let post of postsToCreate) {
      let imgUrls: any = null
      if (post.record?.embed?.images) {
        const images = post.record.embed.images as Array<any>
        const imgLinks = images.map(item => {
          return `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author}/${item.image.ref}`
        })
        imgUrls = imgLinks.join()
      }

      else if (post.record?.embed?.video) {
        const video = post.record.embed.video as any
        imgUrls = `https://video.bsky.app/watch/${post.author}/${video.ref}/thumbnail.jpg`
      }

      else if (post.record?.embed?.external) {
        const external = post.record.embed.external as any
        if (external?.thumb) {
          imgUrls = `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author}/${external.thumb.ref}`
        }
      }

      if (imgUrls) {
        let nsfw = await isNSFW(post.author)
        if (nsfw === -1 && !post.record?.labels?.length) {
          modImagePosts.push({
            uri: post.uri,
            cid: post.cid,
            indexedAt: new Date().toISOString(),
            author: post.author,
            imgUrls
          })
        }
      } else {
        createPosts.push({
          uri: post.uri,
          cid: post.cid,
          indexedAt: new Date().toISOString()
        })
      }
    }

    // log info
    createPosts.forEach(item => console.log(`create post: ${ JSON.stringify(item) }`))
    modImagePosts.forEach(item => console.log(`mod post: ${ JSON.stringify(item) }`))

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
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
}
