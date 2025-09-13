// @ts-nocheck
import { Kysely, Migration, MigrationProvider, sql } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('mod_image_post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .addColumn('author', 'varchar', (col) => col.notNull())
      .addColumn('imgUrls', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('mod_image_post').execute()
    await db.schema.dropTable('sub_state').execute()
  },
}
migrations['002'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('report_image_post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .addColumn('author', 'varchar', (col) => col.notNull())
      .addColumn('imgUrls', 'varchar', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('report_image_post').execute()
  },
}
migrations['003'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable('mod_image_post')
      .addColumn('refAuthor', 'varchar', (col) => col.notNull().defaultTo(''))
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('mod_image_post').dropColumn('refAuthor').execute()
  },
}
migrations['004'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable('post')
      .addColumn('author', 'varchar', (col) => col.notNull().defaultTo(''))
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('post').dropColumn('author').execute()
  },
}
migrations['005'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('topic')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('topic', 'varchar', (col) => col.notNull())
      .addColumn('time', 'integer', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('idx_topic_topic_time')
      .on('topic')
      .columns(['topic', 'time desc'])   // 复合 + 倒序
      .execute();
    await db.schema
      .createIndex('idx_topic_topic')
      .on('topic')
      .columns(['topic'])
      .execute();
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('topic').execute()
  },
}
migrations['006'] = {
  async up(db: Kysely<unknown>) {
    await sql`PRAGMA foreign_keys=OFF`.execute(db);
    await db.schema
      .createTable('tmp_topic')
      .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
      .addColumn('uri', 'varchar', (col) => col.notNull())
      .addColumn('topic', 'varchar', (col) => col.notNull())
      .addColumn('time', 'integer', (col) => col.notNull())
      .execute()

    await db
      .insertInto('tmp_topic')
      .columns(['uri', 'topic', 'time'])
      .expression(
        db.selectFrom('topic').select(['uri', 'topic', 'time'])
      )
      .execute();

    await db.schema.dropTable('topic').execute();
    await db.schema.alterTable('tmp_topic').renameTo('topic').execute();

    await db.schema
      .createIndex('idx_topic_topic_time')
      .on('topic')
      .columns(['topic', 'time desc'])   // 复合 + 倒序
      .execute();
    await db.schema
      .createIndex('idx_topic_topic')
      .on('topic')
      .column('topic')
      .execute();
    await db.schema
      .createIndex('idx_topic_uri')
      .on('topic')
      .column('uri')
      .execute();
    await sql`PRAGMA foreign_keys=ON`.execute(db);
  },
  async down(db: Kysely<unknown>) {
  },
}
migrations['007'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createIndex('idx_post_author')
      .on('post')
      .column('author')
      .execute();
  },
  async down(db: Kysely<unknown>) {
  },
}