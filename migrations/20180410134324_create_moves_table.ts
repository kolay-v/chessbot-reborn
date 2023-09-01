import { type Knex } from 'knex'

export const up = async (knex: Knex): Promise<void> => {
  if (await knex.schema.hasTable('moves')) {
    return
  }
  await knex.schema.createTable('moves', (table) => {
    table.increments('id')
    table.integer('game_id')
      .unsigned()
      .notNullable()
      .index()
      .references('id')
      .inTable('games')
    table.string('entry')
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

export const down = async (knex: Knex): Promise<void> => {
  if (!await knex.schema.hasTable('moves')) {
    return
  }
  await knex.schema.dropTable('moves')
}
