import { Database } from './db'
import { DidResolver } from '@atproto/identity'
import { Sequencer } from './methods/outbox'

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
