import { AsyncBuffer, AsyncBufferFullError } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Labels as LabelsEvt } from '../lexicon/types/com/atproto/label/subscribeLabels'
import EventEmitter from 'node:events'

export type OutboxOpts = {
  maxBufferSize: number
}

export class Sequencer extends EventEmitter {
  constructor() {
    super()
  }
}

export class Outbox {
  private caughtUp = false
  lastSeen = -1

  cutoverBuffer: LabelsEvt[]
  outBuffer: AsyncBuffer<LabelsEvt>

  constructor(
    public sequencer: Sequencer,
    opts: Partial<OutboxOpts> = {},
  ) {
    const { maxBufferSize = 500 } = opts
    this.cutoverBuffer = []
    this.outBuffer = new AsyncBuffer<LabelsEvt>(maxBufferSize)
  }

  // event stream occurs in 3 phases
  // 1. backfill events: events that have been added to the DB since the last time a connection was open.
  // The outbox is not yet listening for new events from the sequencer
  // 2. cutover: the outbox has caught up with where the sequencer purports to be,
  // but the sequencer might already be halfway through sending out a round of updates.
  // Therefore, we start accepting the sequencer's events in a buffer, while making our own request to the
  // database to ensure we're caught up. We then dedupe the query & the buffer & stream the events in order
  // 3. streaming: we're all caught up on historic state, so the sequencer outputs events and we
  // immediately yield them
  async *events(
    backfillCursor?: number,
    signal?: AbortSignal,
  ): AsyncGenerator<LabelsEvt> {
    // if not backfill, we don't need to cutover, just start streaming
    this.caughtUp = true

    // streams updates from sequencer, but buffers them for cutover as it makes a last request

    const addToBuffer = (evts) => {
      this.outBuffer.pushMany(evts)
    }

    if (!signal?.aborted) {
      this.sequencer.on('events', addToBuffer)
    }
    signal?.addEventListener('abort', () =>
      this.sequencer.off('events', addToBuffer),
    )

    while (true) {
      try {
        for await (const evt of this.outBuffer.events()) {
          if (signal?.aborted) return
          if (evt.seq > this.lastSeen) {
            this.lastSeen = evt.seq
            yield evt
          }
        }
      } catch (err) {
        if (err instanceof AsyncBufferFullError) {
          throw new InvalidRequestError(
            'Stream consumer too slow',
            'ConsumerTooSlow',
          )
        } else {
          throw err
        }
      }
    }
  }
}
