import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getBW, putBW } from '../bw'

export default function (server: Server, ctx: AppContext) {
  server.com.hukoubook.fg.getModImagePosts(async (_) => {
    let modqs = await ctx.db
    .selectFrom('mod_image_post')
    .selectAll()
    .execute()
    let mod: any = []
    for (let item of modqs) {
      if (!item.refAuthor) {
        delete item.refAuthor
      }
      mod.push(item)
    }

    let report = await ctx.db
    .selectFrom('report_image_post')
    .selectAll()
    .execute()

    return {
      encoding: 'application/json',
      body: { mod, report },
    }
  })
  server.com.hukoubook.fg.updateNSFW(async ({ input }) => {
    const {categories, move} = input.body
    let rets: any = []
    for (let item of categories) {
      let record = await getBW(item.did)
      if (record.bot !== -1 || item.category === 1) {
        record.nsfw = item.category
        rets.push(record)
      }
    }
    await putBW(rets)

    let authors = rets.map((item: any) => item.did)
    authors.push('')

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
        .where('mod_image_post.refAuthor', 'in', authors)
      )
      .execute();

      await ctx.db.deleteFrom('mod_image_post')
      .where('mod_image_post.author', 'in', authors)
      .where('mod_image_post.refAuthor', 'in', authors)
      .execute()
    } else {
      // user report callback
      await ctx.db.deleteFrom('report_image_post')
      .where('report_image_post.author', 'in', authors)
      .execute()
    }
    return {
      encoding: 'application/json',
      body: {'message': 'ok'}
    }
  })
}
