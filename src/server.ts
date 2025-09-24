import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import modImagePost from './methods/mod-image-post'
import topicTrending from './methods/topic'
import labeler, { http_server } from './methods/labeler'
import { createDb, Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { initDBPool, deleteDB, syncDBFile, checkTalkTooMUchPeopleIsBot, storage } from './dbpool'
import { loggerMiddleware } from './logger'
import { updateJieBaDict } from './topic'
import { updateSystemBoard } from './board'

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
    const app = express()
    app.use(loggerMiddleware)
    const db = createDb(process.env.DB_HOME + cfg.sqliteLocation)
    storage.main = db
    const firehose = new FirehoseSubscription(db, cfg.subscriptionEndpoint)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      timeout: 3*60000,
      plcUrl: process.env.PLC_URL,
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
    modImagePost(server, ctx)
    topicTrending(server, ctx)
    labeler(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))
    return new FeedGenerator(app, db, firehose, cfg)
  }

  setupDBMantainInterval() {
    setInterval(async () => {
      await this.db
        .deleteFrom('post')
        .where('indexedAt', '<=', new Date(Date.now() - 12 * 60 * 60000).toISOString())
        .execute()
      await this.db
        .deleteFrom('mod_image_post')
        .where('indexedAt', '<=', new Date(Date.now() - 12 * 60 * 60000).toISOString())
        .execute()
      await this.db
        .deleteFrom('topic')
        .where('time', '<=', Date.now() - 12 * 60 * 60000)
        .execute()
      await syncDBFile()
    }, 60*60000)
    setInterval(async () => {
      await deleteDB()
    }, 24*60*60000)
    setInterval(async () => {
      await checkTalkTooMUchPeopleIsBot(this.db)
      await updateJieBaDict()
      await updateSystemBoard()
    }, 60*60000)
  }

  async start(): Promise<http.Server> {
    await deleteDB()
    await initDBPool()
    await syncDBFile()
    await migrateToLatest(this.db)
    await updateJieBaDict()
    await updateSystemBoard()
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    http_server['express'] = this.server
    await events.once(this.server, 'listening')
    this.setupDBMantainInterval()
    return this.server
  }
}

export default FeedGenerator
