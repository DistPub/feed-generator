import { Server } from '../lexicon'
import { AppContext } from '../config'
import { isNotGoodTopic } from '../bw';

export default function (server: Server, ctx: AppContext) {
  server.com.hukoubook.fg.removeTopicPosts(async ({ input }) => {
    const rows = await ctx.db
        .selectFrom('topic')
        .selectAll()
        .where('topic', 'in', input.body.topics)
        .execute();
    const uris = rows.map(r => r.uri);

    if (uris.length) {
      await ctx.db
        .deleteFrom('post')
        .where('uri', 'in', uris)
        .execute();
    }
    return {
      encoding: 'application/json',
      body: { message: 'ok' },
    }
  })
  server.com.hukoubook.fg.getTopicTrending(async ({params}) => {
    const topics = await ctx.db
        .selectFrom('topic')
        .select(['topic'])
        .select(eb => [
            eb.fn.max('time').as('updatedAt'),
            eb.fn.count('uri').as('count'),
        ])
        .groupBy('topic')
        .having(eb => eb.fn.count('uri'), '>', params.min)
        .orderBy('count', 'desc')
        .limit(params.limit)
        .execute();

    const notGood = await Promise.all(
        topics.map(async row => Boolean(await isNotGoodTopic(row.topic)))
    );
    const ret = topics.map((item, i) => ({
        topic: item.topic,
        count: Number(item.count),
        updatedAt: new Date(item.updatedAt).toISOString(),
        notGood: notGood[i]
    }));

    return {
      encoding: 'application/json',
      body: { topics: ret },
    }
  })
}