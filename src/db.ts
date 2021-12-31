import knex from 'knex'
import { DB_DRIVER, DB_SQLITE_FILE_NAME } from './env/index.js'

const initDriver = () => {
  switch (DB_DRIVER) {
    case 'sqlite': {
      return knex({
        client: 'sqlite',
        useNullAsDefault: true,
        connection: { filename: DB_SQLITE_FILE_NAME },
      })
    }

    default:
      throw new Error('unknown db driver')
  }
}

export const db = initDriver()
