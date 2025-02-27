import dotenv from 'dotenv'
import inquirer from 'inquirer'
import { AtpAgent, BlobRef, AppBskyFeedDefs } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'

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
        },
        {
          type: 'input',
          name: 'labelerService',
          message: 'Enter labeler service URL:',
          required: true,
        }
    ])

  let { handle, password, labelerService, service } = answers

  const agent = new AtpAgent({ service: service ? service : 'https://bsky.social' })
  await agent.login({ identifier: handle, password})
  let response = await agent.com.atproto.identity.resolveHandle({
    handle
  })
  console.log(`resolved did: ${response.data.did}`)

  console.log('All done 🎉')
}

run()