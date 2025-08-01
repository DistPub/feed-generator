import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, isNotGoodUser, computeBot, isNSFW, signLabel } from '../bw'
import { validateAuth } from '../auth'
import { CreateOp } from '../util/subscription'
import { Record } from '../lexicon/types/app/bsky/feed/post'
import { getPostImgurls } from '../subscription'
import { Outbox } from './outbox'
import { seq, getPostByUri, getDid } from '../config'
import { syncDBFile } from '../dbpool'

export const http_server = {'express': <any>null}

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.label.queryLabels(async ({ req, params }) => {
    console.log(`[queryLabels]${JSON.stringify(req.headers)}`)
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
        labels: labels.map(item => signLabel(item)),
      },
    }
  })

  server.com.atproto.label.subscribeLabels(async function* ({ req, signal }) {
    console.log(`[subscribeLabels]${JSON.stringify(req.headers)}`)
    const outbox = new Outbox(seq)
    for await (const evt of outbox.events(req.headers['cf-connecting-ip'] as string, signal)) {
      yield { $type: '#labels', ...evt }
    }
  })

  server.com.atproto.moderation.createReport(async ({ req, input }) => {
    console.log(`[createReport]${JSON.stringify(req.headers)}`)
    let labeler_did: any = process.env.LABELER_DID
    let requester: any = undefined
    try {
      requester = await validateAuth(req, labeler_did, ctx.didResolver)
    } catch(error) {
      console.error(`validate auth error: ${error}`)
    }
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

    else if (requester && requester === 'did:web:smite.hukoubook.com' && reasonType === 'com.atproto.moderation.defs#reasonOther' && reason === 'command:restart') {
      console.log('force close server after 60 seconds')
      setTimeout(() => {process.exit(1)}, 60000)

      // try graceful
      http_server['express'].close((err) => {
        if (err) {
            console.error('Error closing server:', err);
        } else {
            console.log('Server successfully closed.');
        }
        process.exit(err ? 1 : 0)
      })
    }

    else if (reasonType === 'com.atproto.moderation.defs#reasonSpam') {
      // not good
      if (reason === 'sync')
        await syncDBFile()
      let target = getDid(did || uri)
      ret = await isNotGoodUser(target, true)
      console.log(`report not good did: ${target} ret: ${ret}`)
    }

    else if (reasonType === 'com.atproto.moderation.defs#reasonSexual' || (reasonType === 'com.atproto.moderation.defs#reasonOther' && reason === 'nsfw')) {
      // nsfw
      if (!uri || uri.indexOf('app.bsky.feed.post') === -1) {
        console.log(`report nsfw should from a app.bsky.feed.post record`)
      } else {
        console.log(`report nsfw uri: ${uri} cid: ${cid}`)
        let post = await getPostByUri(uri)

        if (post) {
          let imgUrls = await getPostImgurls(post, false, false)

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
    }

    const body = {
      "id": ret,
      "reasonType": reasonType,
      "subject": subject,
      "reportedBy": requester || 'did:web:undefined.com',
      "createdAt": new Date().toISOString()
    }
    return {
      encoding: 'application/json',
      body,
    }
  })
}
