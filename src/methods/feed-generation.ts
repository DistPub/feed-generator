import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import { event_status } from '../util/subscription'
import { commandRestart } from './labeler'

function isValidAndOver60s(date) {
  const ts = date.getTime()
  if (isNaN(ts)) return false
  return (Date.now() - ts) > 60000
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    // 引流动态源
    if (params.feed == 'at://did:web:cgv.hukoubook.com/app.bsky.feed.generator/china-good-voice') {
      return {
        encoding: 'application/json',
        body: {feed: [{post: "at://did:web:cgv.hukoubook.com/app.bsky.feed.post/3lmjfrs5jc226"}]}
      }
    }

    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]

    // 参数检查
    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        `请搜索关注:中国好声音 [update:${event_status['update']}]`,
        'UnsupportedAlgorithm',
      )
    }
    
    // 系统状态检查
    const update = new Date(event_status['update'])
    if (isValidAndOver60s(update)) {
      console.log('relay event message not received more than 60 seconds, try restart to fix')
      commandRestart()
    }

    // 用户身份获取
    let requesterDid: string | undefined
    try {
      requesterDid = await validateAuth(
        req,
        ctx.cfg.serviceDid,
        ctx.didResolver,
      )
    } catch (err) {
      if (err.errorMessage === 'anonymous') {
        console.log('anonymous request')
      } else {
        throw err
      }
    }

    if (requesterDid) {
      console.log(`feed requested by ${requesterDid}`)
    }

    const body = await algo(ctx, params)
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
