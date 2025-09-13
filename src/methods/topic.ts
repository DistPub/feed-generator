import { Server } from '../lexicon'
import { AppContext, getDid } from '../config'
import { addNotGoodTopics, getBW, isNotGoodTopic, putBW, removeFromDB } from '../bw';
import { sql } from 'kysely';
import { getDB, formatDate, getOffsetDate } from '../dbpool';

export default function (server: Server, ctx: AppContext) {
  server.com.hukoubook.fg.removeTopicPosts(async ({ input }) => {
    await addNotGoodTopics(input.body.topics)
    const rows = await ctx.db
        .selectFrom('topic')
        .selectAll()
        .where('topic', 'in', input.body.topics)
        .execute();
    const dids = [...new Set(rows.map(r => r.uri).map(uri => getDid(uri)))];

    for (let did of dids) {
      const ret = await getBW(did)
      ret.bot = 1
      await putBW([ret])
      await removeFromDB(did)
    }
    return {
      encoding: 'application/json',
      body: { message: 'ok' },
    }
  })
  server.com.hukoubook.fg.getTopicTrending(async ({params}) => {
    let query = ctx.db
        .selectFrom('topic')
        .select(['topic'])
        .select(eb => [
            eb.fn.max('time').as('updatedAt'),
            eb.fn.count('id').as('count'),
        ])

    if (params.uri) {
      if (params.uri.endsWith('*')) {
        query = query.where('uri', 'like', params.uri.replace('*', '%')).groupBy('topic')
      } else {
        query = query.where('uri', '=', params.uri).groupBy('topic')
      }
    } else if (params.search) {
      query = query.where('topic', 'like', `%${params.search}%`).groupBy('topic')
    } else {
      query = query
        .groupBy('topic')
        .having(eb => eb.fn.count('id'), '>', params.min)
    }

    const topics = await query
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

    const h12UserCnt = await ctx.db
      .selectFrom('post')
      .select((eb) => eb.fn.count(sql<string>`DISTINCT author`).as('cnt'))
      .executeTakeFirstOrThrow()
      .then(r => Number(r.cnt));
    const h12PostCnt = await ctx.db
      .selectFrom('post')
      .select((eb) => eb.fn.count('uri').as('cnt'))
      .executeTakeFirstOrThrow()
      .then(r => Number(r.cnt));
    
    let today = new Date()
    const d7UserCnts: number[] = []
    for (let offset of [0, 1, 2, 3, 4, 5, 6].reverse()) {
        const db = await getDB(formatDate(getOffsetDate(today, offset)))
        const cnt = await db
          .selectFrom('black_white')
          .select((eb) => eb.fn.count('did').as('cnt'))
          .executeTakeFirstOrThrow()
          .then(r => Number(r.cnt));
        d7UserCnts.push(cnt);
    }

    return {
      encoding: 'application/json',
      body: { topics: ret, the12hourActiveCount: h12UserCnt, the12hourPostCount: h12PostCnt, the7dayActiveCount: d7UserCnts },
    }
  })
}