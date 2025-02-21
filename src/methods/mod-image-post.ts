import { Server } from '../lexicon'
import { AppContext } from '../config'

export default function (server: Server, ctx: AppContext) {
  server.com.hukoubook.fg.getModImagePosts(async (_) => {
    let builder = ctx.db
      .selectFrom('mod_image_post')
      .selectAll()
    const mod = await builder.execute()

    return {
      encoding: 'application/json',
      body: { mod },
    }
  })
}
