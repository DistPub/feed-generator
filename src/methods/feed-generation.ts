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
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]
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
    
    const update = new Date(event_status['update'])
    if (isValidAndOver60s(update)) {
      console.log('relay event message not received more than 60 seconds, try restart to fix')
      commandRestart()
    }

    const body = await algo(ctx, params)
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
