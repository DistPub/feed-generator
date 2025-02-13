import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType, cached } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)
    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        // only chinese
        let langs = create.record.langs ?? []
        if (langs.includes('zh')) return true

        let cnc = /[\u4e00-\u9fa5]+/.test(create.record.text)
        let japc = /[\u3040-\u309f\u30a0-\u30ff]+/.test(create.record.text)
        let krc = /[\uac00-\ud7af]+/.test(create.record.text)
        return cnc && !japc && !krc
      })
      .filter((create) => {
        // no reply
        return create.record.reply === undefined
      })
      .filter((create) => {
        // no blocked users
        console.log(`new post: ${JSON.stringify(create)}`)
        return cached.blocked_users.includes(create.author) === false
      })
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
