import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'

export const storage: any = {}

type Database = Kysely<DatabaseSchema>

// schema
type BlackWhite = {
    did: string
    bot: number
    nsfw: number
}
type NotChineseWebsite = {
  hostname: string
}
type NotGoodUser = {
  did: string
}
type DatabaseSchema = {
    black_white: BlackWhite
    not_chinese_website: NotChineseWebsite
    not_good_user: NotGoodUser
}
const createDb = (location: string): Database => {
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(location),
    }),
  })
}

// migrate
import { Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}
const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}
migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('black_white')
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .addColumn('bot', 'integer', (col) => col.notNull())
      .addColumn('nsfw', 'integer', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('black_white').execute()
  },
}

// business
let dbpool = {}

export function formatDate(date) {
    const year = date.getFullYear(); // 年份
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份（从0开始，需要+1）
    const day = String(date.getDate()).padStart(2, "0"); // 日

    return `${year}${month}${day}`;
}

export function getOffsetDate(date, offset) {
    let tmpDay = new Date(date)
    tmpDay.setDate(date.getDate() - offset)
    return tmpDay
}

export async function initDBPool() {
  console.log(`init db pool`)
  let today = new Date()
  for (let offset of [0, 1, 2, 3, 4, 5, 6]) {
      await getDB(formatDate(getOffsetDate(today, offset)))
  }
  console.log(`complete init db pool`)
}

export async function getDB(name: string, migrate: boolean = true, genname: boolean = true, useCache: boolean = true) {
    let key = name
    if (genname) {
        key = `bw${key}.db`
    }
    if (useCache && dbpool.hasOwnProperty(key)) {
        return dbpool[key]
    }

    let db = createDb(absKey(key))
    console.log(`set db to pool key ${key}`)
    dbpool[key] = db

    if (migrate) {
      const migrator = new Migrator({ db, provider: migrationProvider })
      const { error } = await migrator.migrateToLatest()
      if (error) throw error
    }
    return db
}

import * as fs from 'fs';

export async function deleteDB() {
  let today = new Date()
  let key = formatDate(getOffsetDate(today, 7))
  key = `bw${key}.db`
  if (dbpool.hasOwnProperty(key)) {
      let db = dbpool[key]
      await db.destroy()
      delete dbpool[key]
  }
  if (fs.existsSync(absKey(key))) fs.unlinkSync(absKey(key))
}

import * as https from 'https'

function downloadFile(url, savePath) {
  console.log(`download file from ${url} to ${savePath}`)
  const writeStream = fs.createWriteStream(savePath);

  return new Promise((resolve, reject) => {
      https.get(url, (response) => {
          if (response.statusCode !== 200) {
              reject(new Error(`Download failed with status code: ${response.statusCode}`));
              return;
          }

          response.pipe(writeStream);
          writeStream.on('finish', () => {
              console.log(`success write to file`)
              writeStream.close();
              resolve(writeStream);
          });
          writeStream.on('error', (err) => {
              console.log(`failed write to file ${err}`)
              fs.unlinkSync(savePath)
              reject(err);
          });
      }).on('error', (err) => {
          console.error(`https get error ${err}`)
          fs.unlinkSync(savePath)
          reject(err);
      });
  });
}

import { seq } from './config'
import { computeBot, getBW, signLabel } from './bw'
export const delayToSync = {time: new Date(0)}
export async function syncDBFile() {
  const now = new Date()
  if (now < delayToSync.time) return
  let synckey = 'sync.db'
  await downloadFile(process.env.NOT_DB_URL, absKey(synckey));

  // close old, active new
  let key = 'not.db'
  let old_not: any = []
  if (dbpool.hasOwnProperty(key)) {
      let db = dbpool[key]
      old_not = await db.selectFrom('not_good_user')
      .selectAll()
      .execute()
      old_not = old_not.map(item => item.did)
      await db.destroy()
  }

  try {
    if (fs.existsSync(absKey(key))) fs.unlinkSync(absKey(key))
    fs.renameSync(absKey(synckey), absKey(key))
  } catch(error) {
    console.log(error)
  }
  let db = await getDB(key, false, false, false)
  let new_not = await db.selectFrom('not_good_user')
  .selectAll()
  .execute()
  new_not = new_not.map(item => item.did)
  let added = new_not.filter(item => !old_not.includes(item))
  let removed = old_not.filter(item => !new_not.includes(item))
  let labels = added.map(item => {
    return {
      uri: item,
      val: 'not-good',
      cts: new Date().toISOString()
    }
  })
  labels.push(...removed.map((item: any) => {
    return {
      uri: item,
      val: 'not-good',
      neg: true,
      cts: new Date().toISOString()
    }
  }))

  if (labels.length) {
    labels = labels.map(item => (signLabel({src: process.env.LABELER_DID, ...item})))
    let events = [{ seq: new Date().getTime(), labels}]
    seq.emit('events', events)
  }
}

function absKey(key: string) {
  return process.env.DB_HOME + key
}


// analysis post
import { Database as MainDB } from './db'
export async function checkTalkTooMUchPeopleIsBot(db: MainDB, threshold: number = 8) {
  console.log('check talk too much people')
  const records = await db
  .selectFrom('post')
  .select('author')
  .groupBy('author')
  .having((eb) => eb.fn.count('author'), '>', threshold)
  .execute();

  for(let record of records) {
    const ret = await getBW(record.author)
    if (ret.bot === 0) {
      const aret = await computeBot(record.author)
      console.log(`auto check talk too much did: ${record.author} ret: ${aret}`)
    }
  }
}