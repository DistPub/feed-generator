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

  const agent = new AtpAgent({ service: service ? service : 'https://bsky.social' })
  await agent.login({ identifier: handle, password})
  let response = await agent.com.atproto.identity.resolveHandle({
    handle
  })
  console.log(`resolved did: ${response.data.did}`)
  let did = response.data.did
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
    record: {
    "$type": "app.bsky.labeler.service",
    "policies": {
        "labelValues": ["not-good", "bot", "not-bot", "nsfw", "not-nsfw"],
        "labelValueDefinitions": [
            {
                "adultOnly": false,
                "blurs": "none",
                "defaultSetting": "hide",
                "identifier": "not-good",
                "locales": [
                    {
                        "description": "The account is category not good.",
                        "lang": "en",
                        "name": "💥not good"
                    },
                    {
                        "description": "账号被分类为噪声用户",
                        "lang": "zh",
                        "name": "💥噪声用户"
                    }
                ],
                "severity": "inform"
            },
            {
            "adultOnly": false,
            "blurs": "none",
            "defaultSetting": "warn",
            "identifier": "bot",
            "locales": [
                {
                    "description": "The account is category bot.",
                    "lang": "en",
                    "name": "🤖bot"
                },
                {
                    "description": "账号被分类为机器人",
                    "lang": "zh",
                    "name": "🤖机器人"
                }
            ],
            "severity": "inform"
            },
            {
            "adultOnly": false,
            "blurs": "none",
            "defaultSetting": "ignore",
            "identifier": "not-bot",
            "locales": [
                {
                    "description": "The account is category not bot.",
                    "lang": "en",
                    "name": "🤖not bot"
                },
                {
                    "description": "账号被分类为非机器人",
                    "lang": "zh",
                    "name": "🧠非机器人"
                }
            ],
            "severity": "none"
            },
            {
            "adultOnly": false,
            "blurs": "content",
            "defaultSetting": "hide",
            "identifier": "nsfw",
            "locales": [
                {
                    "description": "The account is category nsfw.",
                    "lang": "en",
                    "name": "😍nsfw"
                },
                {
                    "description": "账号被分类为NSFW群体",
                    "lang": "zh",
                    "name": "😍NSFW群体"
                }
            ],
            "severity": "alert"
            },
            {
            "adultOnly": false,
            "blurs": "none",
            "defaultSetting": "ignore",
            "identifier": "not-nsfw",
            "locales": [
                {
                    "description": "The account is category not nsfw.",
                    "lang": "en",
                    "name": "🤖not bot"
                },
                {
                    "description": "账号被分类为非NSFW群体",
                    "lang": "zh",
                    "name": "🧠非NSFW群体"
                }
            ],
            "severity": "none"
            }
        ]
    },
    "createdAt": new Date().toISOString()
    }
  })
  console.log('All done 🎉')
}

run()