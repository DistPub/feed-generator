import { Server } from '../lexicon'
import { AppContext } from '../config'
import { isNotGoodTopic } from '../bw';

export default function (server: Server, ctx: AppContext) {
  server.com.hukoubook.fg.getTopicTrending(async (_) => {
    const topics = await ctx.db
        .selectFrom('topic')
        .select(['topic'])
        .select(eb => [
            eb.fn.max('time').as('updatedAt'),
            eb.fn.count('uri').as('count'),
        ])
        .groupBy('topic')
        .having(eb => eb.fn.count('uri'), '>', 3)
        .orderBy('count', 'desc')
        .limit(100)
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