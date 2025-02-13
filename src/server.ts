import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { cached } from './util/subscription'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSubscription
  public cfg: Config

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription,
    cfg: Config,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
  }

  static create(cfg: Config) {
    // FeedGenerator.sync_blocked_users()
    const app = express()
    const db = createDb(cfg.sqliteLocation)
    const firehose = new FirehoseSubscription(db, cfg.subscriptionEndpoint)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    // setInterval(FeedGenerator.sync_blocked_users, 60*60000);
    setInterval(async function() {
      await db
        .deleteFrom('post')
        .where('indexedAt', '<=', new Date(Date.now() - 12 * 60 * 60000).toISOString())
        .execute()
    }, 60*60000)

    return new FeedGenerator(app, db, firehose, cfg)
  }

  static sync_blocked_users() {
    let list_keys = ['3lbhma4rx4k2o', '3lbfa5esptk2s', '3lbeeyopvnk2s']
    Promise.all(list_keys.map(
      list_key => FeedGenerator.fetch_list_users(`at://did:web:smite.hukoubook.com/app.bsky.graph.list/${list_key}`)
    )).then(
      user_list => cached.blocked_users = user_list.flat()
    ).catch(
      error => console.log(`errro when fetch blocked users: ${error}`)
    )
  }

  static async fetch_list_users(uri: string, cursor?: string | null): Promise<string[]> {
    let query = `list=${encodeURIComponent(uri)}&limit=100`
    if (cursor) query = `${query}&cursor=${cursor}`
    let url = `https://public.api.bsky.app/xrpc/app.bsky.graph.getList?${query}`
    let response = await fetch(url)
    if (!response.ok) throw Error(`failed fetch list users: ${url} response not ok`)
    let data: any = await response.json()
    let users = data.items.map(item=>item.subject.did)
    if (data.cursor) users = users.concat(await FeedGenerator.fetch_list_users(uri, data.cursor))
    console.log(`success fetch list users: ${url} total ${users.length}`)
    return users
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator
