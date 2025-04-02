import dotenv from 'dotenv'
import inquirer from 'inquirer'
import { AtpAgent, BlobRef, AppBskyFeedDefs } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'
import * as plc from '@did-plc/lib'
import { secp256k1 as k256 } from "@noble/curves/secp256k1"
import * as ui8 from "uint8arrays";

const SECP256K1_DID_PREFIX = new Uint8Array([0xe7, 0x01]);
const BASE58_MULTIBASE_PREFIX = "z";
const formatMultikey = (
	jwtAlg: any,
	keyBytes: Uint8Array,
): string => {
	let prefixedBytes: Uint8Array;
	prefixedBytes = ui8.concat([SECP256K1_DID_PREFIX, k256.ProjectivePoint.fromHex(keyBytes).toRawBytes(true)]);
	return (BASE58_MULTIBASE_PREFIX + ui8.toString(prefixedBytes, "base58btc"));
};
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

const run = async () => {
  dotenv.config()

  if (!process.env.FEEDGEN_SERVICE_DID && !process.env.FEEDGEN_HOSTNAME) {
    throw new Error('Please provide a hostname in the .env file')
  }

  const answers = await inquirer
    .prompt([
        {
          type: 'input',
          name: 'handle',
          message: 'Enter your Bluesky handle:',
          required: true,
        },
        {
          type: 'password',
          name: 'password',
          message: 'Enter your Bluesky password (preferably an App Password):',
        },
        {
          type: 'input',
          name: 'labelerService',
          message: 'Enter labeler service URL:',
          required: true,
        },
        {
          type: 'input',
          name: 'service',
          message: 'Optionally, enter a custom PDS service to sign in with:',
          default: 'https://bsky.social',
          required: false,
        },
        {
            type: 'input',
            name: 'privateKey',
            message: 'private key:',
            required: true,
        },
        {
            type: 'input',
            name: 'token',
            message: 'if you already got a token:',
            required: false,
        }
    ])

  let { handle, password, labelerService, service, token, privateKey } = answers
  handle = 'cgv.hukoubook.com'
  labelerService = 'https://labeler.hukoubook.com'
  service = 'https://network.hukoubook.com'

  const agent = new AtpAgent({ service: service ? service : 'https://bsky.social' })
  await agent.login({ identifier: handle, password})
  let response = await agent.com.atproto.identity.resolveHandle({
    handle
  })
  console.log(`resolved did: ${response.data.did}`)
  let did = response.data.did

  if (!token && did.startsWith('did:plc:')) {
    let r1 = await agent.com.atproto.identity.requestPlcOperationSignature()
    if (!r1.success) {
        console.log('send token to email failed')
        return
    }
    let tokeninput = await inquirer
        .prompt([{
            type: 'input',
            name: 'token',
            message: 'Enter your email received token:',
            required: true,
        }])
    token = tokeninput.token
  }

  if (did.startsWith('did:plc:')) {
    const plcClient = new plc.Client(process.env.PLC_URL as string)
    let doc = await plcClient.getDocumentData(did)
    let services = doc.services
    services["atproto_labeler"] = {
      "type": "AtprotoLabeler",
      "endpoint": labelerService
    }
    const thekey = parsePrivateKey(privateKey)
    console.log(thekey)
    const publicKey = k256.getPublicKey(thekey);
    const keyDid = 'did:key:' + formatMultikey('ES256K', publicKey);
    let verificationMethods = doc.verificationMethods
    verificationMethods['atproto_label'] = keyDid
    console.log(services)
    let r2 = await agent.com.atproto.identity.signPlcOperation({
      token,
      services,
      verificationMethods,
    })
    let operation: any = r2.data.operation
    console.log(operation)
    await agent.com.atproto.identity.submitPlcOperation({operation})
  } else {
    console.log('modify your did.json like belows')
    const add_service = {
      "id": "#atproto_labeler",
      "type": "AtprotoLabeler",
      "serviceEndpoint": labelerService
    }
    console.log(JSON.stringify(add_service))

    const thekey = parsePrivateKey(privateKey)
    console.log(thekey)
    const publicKey = k256.getPublicKey(thekey);
    const keyDid = formatMultikey('ES256K', publicKey);
    const add_method = {
      "id": `${did}#atproto_label`,
      "type": "Multikey",
      "controller": did,
      "publicKeyMultibase": keyDid
    }
    console.log(JSON.stringify(add_method))
  }
  console.log('All done 🎉')
}

run()