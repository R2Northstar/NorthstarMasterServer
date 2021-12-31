import knex from 'knex'
import { type SQLDriver } from '../driver.js'

export const createSqliteDriver = async () => {
  const driver: SQLDriver = {
    builder: knex({ client: 'pg' }),

    async query(query, parameters) {
      throw new Error('not implemented')
    },

    async querySingle(query, parameters) {
      throw new Error('not implemented')
    },

    async execute(query, parameters) {
      throw new Error('not implemented')
    },
  }

  return Object.freeze(driver)
}
