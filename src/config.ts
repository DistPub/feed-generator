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
