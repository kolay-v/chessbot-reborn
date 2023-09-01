import { type Knex } from 'knex'

export const up = async (knex: Knex): Promise<void> => {
  if (await knex.schema.hasTable('users')) {
    return
  }
  await knex.schema.createTable('users', (table) => {
    table.bigint('id').unsigned().primary()
    table.string('first_name')
    table.string('last_name')
    table.string('username')
    table.string('language_code')
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable()
  })
}

export const down = async (knex: Knex): Promise<void> => {
  if (!await knex.schema.hasTable('users')) {
    return
  }
  await knex.schema.dropTable('users')
}
