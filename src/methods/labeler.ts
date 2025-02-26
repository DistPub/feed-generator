import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, isNotGoodUser } from '../bw'

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
}
