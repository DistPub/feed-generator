import { formatDate, getDB, getOffsetDate, storage } from './dbpool'
import { getDid, seq, urlPattern } from './config'
import { Database } from './db'

export async function getBW(did: string) {
    let today = new Date()
    const query = async (db) => {
        return await (db.selectFrom('black_white')
        .selectAll()
        .where('black_white.did', '=', did)
        .execute())
    }
    let rows = await query(await getDB(formatDate(today)))

    if (rows.length === 0) {
        // look others
        for (let offset of [1, 2, 3, 4, 5, 6]) {
            rows = await query(await getDB(formatDate(getOffsetDate(today, offset))))
            if (rows.length) {
                await putBW(rows)
                break
            }
        }
    }

    if (rows.length) {
        return rows[0]
    }
    return {did, bot: -1, nsfw: -1}
}

export async function putBW(values: any) {
    let today = new Date()
    let db = await getDB(formatDate(today))
    await (db.insertInto('black_white')
    .values(values)
    .onConflict((oc) => (
        oc.column('did').doUpdateSet((eb) => (
            {
                bot: eb.ref('excluded.bot'),
                nsfw: eb.ref('excluded.nsfw')
            }
        )
    )))
    .execute())

    // emit event
    let labels: any = []
    for (let item of values) {
      if (item.bot !== -1) {
        labels.push({
          uri: item.did,
          val: item.bot === 1 ? 'not-bot' : 'bot',
          neg: true,
          cts: new Date().toISOString()
        })
        labels.push({
          uri: item.did,
          val: item.bot === 1 ? 'bot' : 'not-bot',
          cts: new Date().toISOString()
        })
      }
      if (item.nsfw !== -1) {
        labels.push({
          uri: item.did,
          val: item.nsfw === 1 ? 'not-nsfw' : 'nsfw',
          neg: true,
          cts: new Date().toISOString()
        })
        labels.push({
          uri: item.did,
          val: item.nsfw === 1 ? 'nsfw' : 'not-nsfw',
          cts: new Date().toISOString()
        })
      }
    }
    labels = labels.map(item => (signLabel({src: process.env.LABELER_DID, ...item})))
    let events = [{ seq: new Date().getTime(), labels}]
    seq.emit('events', events)
}

export async function isBot(did: string) {
    // try cache
    let ret = await getBW(did)
    if (ret.bot !== -1) {
        return ret.bot
    }

    // compute
    return await computeBot(did, ret)
}

export async function removeFromDB(did: string) {
  const db = storage.main as Database
  await db.deleteFrom('post')
      .where('post.author', '=', did)
      .execute()
  await db.deleteFrom('mod_image_post')
      .where('mod_image_post.author', '=', did)
      .execute()
  await db.deleteFrom('report_image_post')
      .where('report_image_post.author', '=', did)
      .execute()
}

export async function computeBot(did: string, ret: any = undefined) {
    if (ret === undefined) ret = await getBW(did)
    // check topic
    const post_not_good_topic = await authorPostNotGoodTopic(did)
    if (post_not_good_topic) {
      ret.bot = 1
      await putBW([ret])
      await removeFromDB(did)
      return ret.bot
    }

    let url = `${process.env.PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&filter=posts_no_replies&includePins=false&limit=30`
    let response = await fetch(url)
    let data = await response.json() as any
    if (data.error || data.feed.length < 4) {
        return -1
    }

    // check frequncy
    const registerTime = (new Date(data.feed[0].post.author.createdAt)).getTime()
    const nowTime = (new Date()).getTime()
    let newUser = true
    if ((nowTime - registerTime)/1000/3600/24 > 7 || data.feed.length >= 13) {
      newUser = false
    }
    let t = 1
    let idx = 0
    const window = newUser ? 4 : 13
    const unit = newUser ? 60 : 3600
    while ((data.feed.length - idx) >= window) {
      const segments: any[] = data.feed.slice(idx, idx + window)
      const [a, b] = [segments.shift(), segments.pop()]
      const a_time = (new Date(a.post.record.createdAt)).getTime()
      const b_time = (new Date(b.post.record.createdAt)).getTime()
      t = (a_time - b_time)/(window - 1)/1000/unit
      if (t < 1) break
      idx ++
    }
    ret.bot = t < 1 ? 1 : 0

    if (ret.bot) {
      await putBW([ret])
      await removeFromDB(did)
      return ret.bot
    }

    // check content link percentage
    let counter = 0
    for (let feed of data.feed) {
      if (feed.post.record?.facets) {
        const facets_types = feed.post.record.facets.map(item => item.features).reduce((s, t) => [...s, ...t], []).map(item => item.$type)
        if (facets_types.includes('app.bsky.richtext.facet#link')) {
          counter += 1
          continue
        }
      }

      if (feed.post.record?.embed) {
        if (feed.post.record.embed.$type === 'app.bsky.embed.external') {
          counter += 1
          continue
        }
      }

      if (urlPattern.test(feed.post.record.text)) {
        counter += 1
        continue
      }
    }

    if (counter >= (data.feed.length * 0.8) && !newUser) {
      ret.bot = 1
    }

    await putBW([ret])

    if (ret.bot) {
      await removeFromDB(did)
    }
    return ret.bot
}

const nsfw_labels: string[] = [
  "porn",
  "sexual",
  "nudity",
]
async function fetchModRs(did: string) {
  let aturi = `at://${did}/app.bsky.feed.post/*`
  let url = `${process.env.MOD_API}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(aturi)}&limit=50`
  console.log(url)
  let response = await fetch(url)

  let data;
  try {
    data = await response.json() as any
  } catch (error) {
    return -1
  }

  let labels = data.labels.filter(item => {
    return nsfw_labels.includes(item.val)
  })

  // check labeled uri if exists or not
  let uris = labels.map(item => `uris=${encodeURIComponent(item.uri)}`)
  let posts = []
  for (let i = 0; i < uris.length; i += 25) {
    let url = `${process.env.PUBLIC_API}/xrpc/app.bsky.feed.getPosts?${uris.slice(i, i + 25).join('&')}`
    let response = await fetch(url)
    let data = await response.json() as any
    // ignore missing
    posts = posts.concat(data.posts.filter(item => !item.missing))
  }
  let nsfw = 0
  if (posts.length) nsfw = 1
  return nsfw
}

export async function isNSFW(did: string, useCache: boolean = true) {
    // try cache
    let ret = await getBW(did)

    if (useCache && ret.nsfw === 1) {
      return 1
    }

    if (useCache && ret.nsfw === 0) {
      if (await fetchModRs(did) === 1) {
        ret.nsfw = 1
        await putBW([ret])
      }
      return ret.nsfw
    }

    let nsfw = await fetchModRs(did)

    if (nsfw === 1) {
      ret.nsfw = 1
      await putBW([ret])
      return nsfw
    }
    return -1
}

import { cntld, cctld } from './country'

export async function isNotChineseWebsite(hostname: string) {
    const parts = hostname.split('.');
    const tld = `.${parts.pop()}`
    if (!cntld.includes(tld) && cctld.includes(tld)) return true

    let db = await getDB('not.db', false, false)
    let rows = await db.selectFrom('not_chinese_website')
    .selectAll()
    .where('not_chinese_website.hostname', '=', hostname)
    .execute()
    return rows.length
}

export async function authorPostNotGoodTopic(author: string, topics: string[] = []) {
  const db = storage.main as Database
  if (topics.length === 0) {
    const rows = await db.selectFrom('topic')
      .select('topic')
      .where('uri', 'like', `at://${author}/%`)
      .groupBy('topic')
      .execute()
    topics.push(...rows.map(r => r.topic))
  }
  for (let topic of topics) {
    if (await isNotGoodTopic(topic)) {
      return true
    }
  }
  return false
}

export async function isNotGoodTopic(topic: string) {
  let db = await getDB('not.db', false, false)
  let rows = await db.selectFrom('not_good_topic')
  .selectAll()
  .where('not_good_topic.topic', '=', topic)
  .execute()
  return rows.length
}

export async function bufferBanTopic(uri: string, db: Database, buffer: number = 3600000) {
  let data = await db
    .selectFrom('topic')
    .select(['topic', 'time'])
    .where('uri', '=', uri)
    .execute()

  if (data.length === 0) {
    console.warn(`not found topic by uri: ${uri}, only ban report uri author`)
    const did = getDid(uri)
    const ret = await getBW(did)
    ret.bot = 1
    await putBW([ret])
    await removeFromDB(did)
    return
  }

  const banTopics = data.map(row => row.topic)
  const ltime = data[0].time - buffer
  const gtime = data[0].time + buffer
  const rows = await db
    .selectFrom('topic')
    .selectAll()
    .where('topic', 'in', banTopics)
    .where('time', '>=', ltime)
    .where('time', '<=', gtime)
    .execute();
  const dids = [...new Set(rows.map(r => r.uri).map(uri => getDid(uri)))];

  for (let did of dids) {
    const ret = await getBW(did)
    ret.bot = 1
    await putBW([ret])
    await removeFromDB(did)
  }
  console.log(`topic buffer ban ${dids.length} did`)
}

export async function addNotGoodTopics(topics: string[]) {
  let db = await getDB('not.db', false, false)
  await db
    .insertInto('not_good_topic')
    .values(topics.map(topic => {
      return {
        topic
      }
    }))
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export async function isNotGoodUser(did: string, emit: boolean = false) {
  let db = await getDB('not.db', false, false)
  let rows = await db.selectFrom('not_good_user')
  .selectAll()
  .where('not_good_user.did', '=', did)
  .execute()
  let ret = rows.length

  if (emit) {
    let labels: any = []
    if (ret) {
      labels.push({
        uri: did,
        val: 'not-good',
        cts: new Date().toISOString()
      })
    } else {
      labels.push({
        uri: did,
        val: 'not-good',
        neg: true,
        cts: new Date().toISOString()
      })
    }
    labels = labels.map(item => (signLabel({src: process.env.LABELER_DID, ...item})))
    let events = [{ seq: new Date().getTime(), labels}]
    seq.emit('events', events)
  }
  return ret
}

import { sha256 } from "@noble/hashes/sha256";
import { secp256k1 as k256 } from "@noble/curves/secp256k1"
import { cborEncode } from '@atproto/common'
import { signKey } from './config'

export function k256Sign(privateKey: Uint8Array, msg: Uint8Array): Uint8Array {
	const msgHash = sha256(msg);
	const sig = k256.sign(msgHash, privateKey, { lowS: true });
	return sig.toCompactRawBytes();
}

export function signLabel(label) {
  const toSign = {...label, ver: 1};
	const bytes = cborEncode(toSign);
	const sig = k256Sign(signKey, bytes);
	return { ...toSign, sig };
}
