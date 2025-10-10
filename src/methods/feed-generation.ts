import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import { event_status } from '../util/subscription'
import { commandRestart } from './labeler'
import { getUserMsg, PRIORITY_IMPORTANT, PRIORITY_NORMAL, PRIORITY_SUPER } from '../board'

function isValidAndOver60s(date) {
  const ts = date.getTime()
  if (isNaN(ts)) return false
  return (Date.now() - ts) > 60000
}

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    // 引流动态源
    if (params.feed == process.env.DRIVE_TRAFFIC_FEED_URI) {
      return {
        encoding: 'application/json',
        body: {feed: [{post: process.env.DRIVE_TRAFFIC_POST_URI as string}]}
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

    // 根据用户身份推送系统消息
    let msg
    try {
      const requesterDid = await validateAuth(
        req,
        ctx.cfg.serviceDid,
        ctx.didResolver,
      )
      msg = await getUserMsg(requesterDid, ctx.db)
    } catch (err) {
      if (err.errorMessage != 'anonymous') {
        throw err
      }
    }
    const body = await algo(ctx, params)

    if ((msg?.priority === PRIORITY_NORMAL && !params.cursor) || (msg?.priority === PRIORITY_IMPORTANT)) {
      body.feed = body.feed.filter(item => item.post !== msg.uri)
      body.feed.unshift({ post: msg.uri })
    } else if (msg?.priority === PRIORITY_SUPER){
      delete body.cursor
      body.feed = [{ post: msg.uri }]
    }
    
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
