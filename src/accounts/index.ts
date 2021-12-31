import knex from 'knex'

// TODO: Implement selection
export const db = knex({
  client: 'sqlite',
  useNullAsDefault: true,
  connection: { filename: './playerdata.db' },
})

const hasAccountsTable = await db.schema.hasTable('accounts')
if (!hasAccountsTable) {
  await db.schema.createTable('accounts', table => {
    table.text('id').notNullable().primary()
    table.text('authToken').notNullable()
    table.integer('authTokenExpireTime').notNullable()
    table.text('currentServerID')
    table.binary('persistentDataBaseline').notNullable()
  })
}

export { createAccount, getById, getOrCreate } from './account.js'
