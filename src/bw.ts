import { formatDate, getDB, getOffsetDate } from './dbpool'

async function getBW(did: string) {
    let today = new Date()
    const query = async thedb => {
        return await thedb.selectFrom('black_white')
        .selectAll()
        .where('black_white.did', '=', did)
        .execute()
    }
    let rows = await query(await getDB(formatDate(today)))

    if (rows.length === 0) {
        // look others
        for (let offset of [1, 2, 3, 4, 5, 6]) {
            rows = query(getDB(formatDate(getOffsetDate(today, offset))))
            if (rows) {
                putBW(rows)
                break
            }
        }
    }

    if (rows) {
        return rows[0]
    }
    return {did, bot: -1, nsfw: -1}
}

async function putBW(values: any) {
    let today = new Date()
    let db = await getDB(formatDate(today))
    await db.insertInto('black_white')
    .values(values)
    .onConflict((oc) => (
        oc.column('did').doUpdateSet((eb) => (
            {
                bot: eb.ref('excluded.bot'),
                nsfw: eb.ref('excluded.nsfw')
            }
        )
    )))
    .execute()
}

export async function isBot(did: string) {
    // try cache
    let ret = await getBW(did)
    if (ret.bot !== -1) {
        return ret.bot
    }

    // compute
    let response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&filter=posts_no_replies&includePins=false&limit=30`)
    let data = await response.json() as any
    if (data.error || data.feed.length < 2) {
        return -1
    }
    let a = new Date(data.feed[0].post.record.createdAt) as any
    let b = new Date(data.feed[data.feed.length - 1].post.record.createdAt) as any
    let t = (a - b)/data.feed.length/1000/60/60
    ret.bot = t < 1
    await putBW([ret])
    return ret.bot
}