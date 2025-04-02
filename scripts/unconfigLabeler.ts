import dotenv from 'dotenv'
import inquirer from 'inquirer'
import { AtpAgent, BlobRef, AppBskyFeedDefs } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'
import * as plc from '@did-plc/lib'

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
          name: 'service',
          message: 'Optionally, enter a custom PDS service to sign in with:',
          default: 'https://bsky.social',
          required: false,
        }
    ])

  let { handle, password, service } = answers
  handle = 'china-good-voice.bsky.social'

  let res = await fetch(`${service}/xrpc/com.atproto.server.createSession`, {
    'method': 'POST',
    body: JSON.stringify({ identifier: handle, password, allowTakendown: true}),
    headers: {
      'content-type': 'application/json'
    }
  })
  let session = await res.json() as any
  console.log(session as string)
  res = await fetch(`${service}/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`)
  let data = await res.json() as any
  console.log(`resolved did: ${data.did}`)
  let did = data.did
  res = await fetch(`${service}/xrpc/com.atproto.repo.deleteRecord`, {
    body: JSON.stringify({repo: did, collection: "app.bsky.labeler.service", rkey: 'self'}),
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${session.accessJwt}`
    }
  })
  data = await res.json()
  console.log(data as string)
  console.log('All done 🎉')
}

run()