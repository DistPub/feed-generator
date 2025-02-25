import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, putBW } from '../bw'

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
  server.com.hukoubook.fg.updateNSFW(async ({ input }) => {
    const {categories, move} = input.body
    let rets = categories.map(async item => {
      let record = await getBW(item.did)
      record.nsfw = item.category
      return record
    })
    try {
    await putBW(rets)
    } catch (error) {console.error(error)}
    console.log('in here')

    let authors = rets.map((item: any) => item.did)
    
    // feed mod callback
    if (move) {
      await ctx.db.insertInto('post')
      .columns(["uri", "cid", "indexedAt"])
      .expression((eb) => eb
        .selectFrom('mod_image_post')
        .select((eb) => [
          'mod_image_post.uri',
          'mod_image_post.cid',
          eb.val(new Date().toISOString()).as('indexedAt')
        ])
        .where('mod_image_post.author', 'in', authors)
      )
      .execute();

      await ctx.db.deleteFrom('mod_image_post')
      .where('mod_image_post.author', 'in', authors)
      .execute()
    } else {
      // user report callback
    }
    return {
      encoding: 'application/json',
      body: {'message': 'ok'}
    }
  })
}
