import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'

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

export async function getDB(key: string, migrate: boolean = true) {
    if (dbpool.hasOwnProperty(key)) {
        return dbpool[key]
    }

    let db = createDb(`bw${key}.db`)
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
  if (dbpool.hasOwnProperty(key)) {
      let db = dbpool[key]
      await db.close()
  }
  if (fs.existsSync(key)) fs.unlinkSync(key)
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

export async function syncDBFile() {
  let synckey = 'sync.db'
  await downloadFile(process.env.NOT_DB_URL, synckey);

  // close old, active new
  let key = 'not.db'
  if (dbpool.hasOwnProperty(key)) {
      let db = dbpool[key]
      await db.close()
  }
  if (fs.existsSync(key)) fs.unlinkSync(key)
  fs.renameSync(synckey, key)
  await getDB(key, false)
}
