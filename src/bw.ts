import { formatDate, getDB, getOffsetDate } from './dbpool'
import { seq } from './config'
import { lexToJson } from '@atproto/lexicon'

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
          val: item.bot === 1 ? 'nsfw' : 'not-nsfw',
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

export async function computeBot(did: string, ret: any = undefined) {
    let url = `${process.env.PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed?actor=${did}&filter=posts_no_replies&includePins=false&limit=30`
    let response = await fetch(url)
    let data = await response.json() as any
    if (data.error || data.feed.length < 2) {
        return -1
    }
    let a = new Date(data.feed[0].post.record.createdAt) as any
    let b = new Date(data.feed[data.feed.length - 1].post.record.createdAt) as any
    let t = (a - b)/data.feed.length/1000/60/60

    if (ret === undefined) ret = await getBW(did)
    ret.bot = t < 1 ? 1 : 0

    await putBW([ret])
    return ret.bot
}

export async function isNSFW(did: string, useCache: boolean = true) {
    // try cache
    let ret = await getBW(did)
    let aturi = `at://${did}/app.bsky.feed.post/*`
    let url = `${process.env.MOD_API}/xrpc/com.atproto.label.queryLabels?uriPatterns=${encodeURIComponent(aturi)}&limit=1`
    let response = await fetch(url)
    let data = await response.json() as any
    let nsfw = 0
    if (data.labels.length) nsfw = 1
    let cached_not_equal = useCache && ret.nsfw !== -1 && ret.nsfw != nsfw
    let no_cache_is_black = (!useCache || ret.nsfw === -1) && nsfw === 1

    if (cached_not_equal || no_cache_is_black) {
        ret.nsfw = nsfw
        await putBW([ret])
        return nsfw
    }

    if (useCache && ret.nsfw !== -1) {
        return ret.nsfw
    }

    return -1
}

import { cntld, cctld } from './country'

export async function isNotChineseWebsite(hostname: string) {
    const parts = hostname.split('.');
    const tld = parts.pop() as string
    if (!cntld.includes(tld) && cctld.includes(tld)) return true

    let db = await getDB('not.db', false, false)
    let rows = await db.selectFrom('not_chinese_website')
    .selectAll()
    .where('not_chinese_website.hostname', '=', hostname)
    .execute()
    return rows.length
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
