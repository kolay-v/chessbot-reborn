import { type Knex } from 'knex'

export const up = async (knex: Knex): Promise<void> => {
  if (await knex.schema.hasTable('games')) {
    return
  }
  await knex.schema.createTable('games', (table) => {
    table.increments('id')
    table.bigInteger('whites_id').unsigned().notNullable().index().references('id').inTable('users')
    table.bigInteger('blacks_id').unsigned().notNullable().index().references('id').inTable('users')
    table.string('inline_id').notNullable().unique().index()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

export const down = async (knex: Knex): Promise<void> => {
  if (!await knex.schema.hasTable('games')) {
    return
  }
  await knex.schema.dropTable('games')
}
