import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'

export type Database = Kysely<DatabaseSchema>

// schema

export type BlackWhite = {
    did: string
    bot: number
    nsfw: number
}

export type DatabaseSchema = {
    black_white: BlackWhite
}

export const createDb = (location: string): Database => {
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(location),
    }),
  })
}

import { Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
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

export async function getDB(key: string) {
    if (dbpool.hasOwnProperty(key)) {
        return dbpool[key]
    }

    let db = createDb(`bw${key}.db`)
    console.log(`set db to pool key ${key}`)
    dbpool[key] = db
    const migrator = new Migrator({ db, provider: migrationProvider })
    const { error } = await migrator.migrateToLatest()
    if (error) throw error
    return db
}
