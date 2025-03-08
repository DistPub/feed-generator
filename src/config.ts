import { Database } from './db'
import { DidResolver } from '@atproto/identity'
import { Sequencer } from './methods/outbox'
import * as ui8 from "uint8arrays";

export const parsePrivateKey = (privateKey: string): Uint8Array => {
	let keyBytes: Uint8Array | undefined;
	try {
		keyBytes = ui8.fromString(privateKey, "hex");
		if (keyBytes?.byteLength !== 32) throw 0;
	} catch {
		try {
			keyBytes = ui8.fromString(privateKey, "base64url");
		} catch {}
	} finally {
		if (!keyBytes) {
			throw new Error("Invalid private key. Must be hex or base64url, and 32 bytes long.");
		}
		return keyBytes;
	}
};
export const signKey = parsePrivateKey(process.env.SIGN_KEY as string)
export const seq = new Sequencer()

import { CreateOp } from './util/subscription'
import { Record } from './lexicon/types/app/bsky/feed/post'
export async function getPostByUri(uri: string) {
	let url = `${process.env.PUBLIC_API}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`
	let response = await fetch(url)
	console.log(`get post fetch url: ${url}`)

	let data = await response.json() as any
	let post: CreateOp<Record> = {
		author: data.thread.post.author.did,
		record: data.thread.post.record,
		uri,
		cid: data.thread.post.cid
	}
	return post
}

export function getDid(uri: string) {
  if (uri.startsWith('at://')){
	let idx = uri.indexOf('/', 5)
	return uri.slice(5, idx)
  }

  if (uri.startsWith('did:')) {
	return uri
  }

  throw Error(`not support uri ${uri}`)
}

export type AppContext = {
  db: Database
  didResolver: DidResolver
  cfg: Config
}

export type Config = {
  port: number
  listenhost: string
  hostname: string
  sqliteLocation: string
  subscriptionEndpoint: string
  serviceDid: string
  publisherDid: string
  subscriptionReconnectDelay: number
}
