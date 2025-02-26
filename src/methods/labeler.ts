import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, isNotGoodUser } from '../bw'
import { validateAuth } from '../auth'

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
    const requester = await validateAuth(req, ctx.cfg.serviceDid, ctx.didResolver)
    const { reasonType, reason } = input.body
    console.log(`${requester} report ${reasonType} with ${reason}`)
    const subject = input.body.subject

    if (reasonType === 'reasonOther' && reason === 'bot') {
      // bot
      console.log(`report bot`)
    }

    if (reasonType === 'reasonSexual' || (reasonType === 'reasonOther' && reason === 'nsfw')) {
      // nsfw
      console.log(`report nsfw`)
    }

    const body = {
      "id": 100,
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
