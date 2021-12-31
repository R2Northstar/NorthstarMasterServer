import knex from 'knex'
import { DB_DRIVER, DB_PSQL_CONN, DB_SQLITE_FILE_NAME } from '~env/index.js'

const initDriver = () => {
  switch (DB_DRIVER) {
    case 'sqlite': {
      return knex({
        client: 'sqlite',
        useNullAsDefault: true,
        connection: { filename: DB_SQLITE_FILE_NAME },
      })
    }

    case 'pg': {
      return knex({
        client: 'pg',
        connection: DB_PSQL_CONN,
      })
    }

    default:
      throw new Error('unknown db driver')
  }
}

export const db = initDriver()
