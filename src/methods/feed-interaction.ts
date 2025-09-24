import { Server } from '../lexicon'
import { AppContext } from '../config'
import { validateAuth } from '../auth'
import { ackUserMsg } from '../board'


export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.sendInteractions(async ({ input, req }) => {
    const { interactions } = input.body
    const requesterDid = await validateAuth(
        req,
        ctx.cfg.serviceDid,
        ctx.didResolver,
    )
    for (const action of interactions) {
        if (action.event === "app.bsky.feed.defs#requestMore" && action.item) {
            await ackUserMsg(requesterDid, action.item, ctx.db)
        }
    }
    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
