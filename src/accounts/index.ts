import { db } from '../db.js'

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
