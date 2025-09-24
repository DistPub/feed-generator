import { Server } from '../lexicon'
import { AppContext } from '../config'
import { validateAuth } from '../auth'
import { ackUserMsg, checkLabeler } from '../board'


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

    const labelers: string[] = []
    if (req.headers['atproto-accept-labelers']) {
        const labelerHeader = req.headers['atproto-accept-labelers'] as string
        const items = labelerHeader.split(',').map(i => i.trim()).filter(i => i.length > 0).map(i => i.split(';')[0])
        labelers.push(...items)
    }
    await checkLabeler(requesterDid, labelers, ctx.db)
    return {
      encoding: 'application/json',
      body: {},
    }
  })
}
