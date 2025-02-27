import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, isNotGoodUser, computeBot, isNSFW } from '../bw'
import { validateAuth } from '../auth'
import { CreateOp } from '../util/subscription'
import { Record } from '../lexicon/types/app/bsky/feed/post'
import { getPostImgurls } from '../subscription'

function getDid(uri: string) {
  if (uri.startsWith('at://')){
    let idx = uri.indexOf('/', 5)
    return uri.slice(5, idx)
  }

  if (uri.startsWith('did:')) {
    return uri
  }

  throw Error(`not support uri ${uri}`)
}

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.queryLabels(async ({ params }) => {
    const { uriPatterns, sources, limit, cursor } = params
    let labels: any = []
    for (let uri of uriPatterns) {
      let did = getDid(uri)
      let ret = await getBW(did)
      if (ret.bot !== -1) {
        labels.push({
          src: process.env.LABELER_DID,
          uri: did,
          val: ret.bot === 1 ? 'bot' : 'not-bot',
          cts: new Date().toISOString()
        })
      }
      if (ret.nsfw !== -1) {
        labels.push({
          src: process.env.LABELER_DID,
          uri: did,
          val: ret.nsfw === 1 ? 'nsfw' : 'not-nsfw',
          cts: new Date().toISOString()
        })
      }
      let not_good = await isNotGoodUser(did)
      if (not_good) {
        labels.push({
          src: process.env.LABELER_DID,
          uri: did,
          val: 'not-good',
          cts: new Date().toISOString()
        })
      }
    }

    return {
      encoding: 'application/json',
      body: {
        labels,
      },
    }
  })

  server.com.atproto.label.subscribeLabels(async function* ({
    params,
    signal,
  }) {
    const { cursor } = params
    yield await new Promise((resolve, reject) => {})
  })

  server.com.atproto.moderation.createReport(async ({ req, input }) => {
    let labeler_did: any = process.env.LABELER_DID
    const requester = await validateAuth(req, labeler_did, ctx.didResolver)
    const { reasonType, reason } = input.body
    console.log(`${requester} report ${reasonType} with ${reason}`)
    const subject = input.body.subject as any
    let { did, uri, cid } = subject
    let ret = 100


    if (reasonType === 'com.atproto.moderation.defs#reasonOther' && reason === 'bot') {
      // bot
      let target = getDid(did || uri)
      ret = await computeBot(target)
      console.log(`report bot did: ${target} ret: ${ret}`)
    }

    else if (reasonType === 'com.atproto.moderation.defs#reasonSexual' || (reasonType === 'com.atproto.moderation.defs#reasonOther' && reason === 'nsfw')) {
      // nsfw
      if (!uri || uri.indexOf('app.bsky.feed.post') === -1) {
        console.log(`report nsfw should from a app.bsky.feed.post record`)
      } else {
        console.log(`report nsfw uri: ${uri} cid: ${cid}`)
        let url = `${process.env.PUBLIC_API}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`
        let response = await fetch(url)
        console.log(`get post fetch url: ${url}`)

        let data = await response.json() as any
        let post: CreateOp<Record> = {
          author: data.thread.post.author.did,
          record: data.thread.post.record,
          uri,
          cid
        }
        let imgUrls = getPostImgurls(post, false)

        if (imgUrls && !post.record?.labels?.length) {
          ret = await isNSFW(post.author, false)

          if (ret === -1) {
            let rows = [{
              uri: post.uri,
              cid: post.cid,
              indexedAt: new Date().toISOString(),
              author: post.author,
              imgUrls
            }]

            await ctx.db
            .insertInto('report_image_post')
            .values(rows)
            .onConflict((oc) => oc.doNothing())
            .execute()
            console.log(`save to report db`)
          }
        } else {
          console.log(`no img found or record already labeled`)
        }
      }
    }

    const body = {
      "id": ret,
      "reasonType": reasonType,
      "subject": subject,
      "reportedBy": requester,
      "createdAt": new Date().toISOString()
    }
    return {
      encoding: 'application/json',
      body,
    }
  })
}
