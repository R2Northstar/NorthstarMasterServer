import { type Knex } from 'knex'
import { createSqliteDriver } from './drivers/sqlite.js'

export type Row = Record<string, unknown>
export interface SQLDriver {
  readonly builder: Knex

  query(query: string, parameters: unknown[]): Promise<Row[]>
  querySingle(query: string, parameters: unknown[]): Promise<Row | undefined>
  execute(query: string, parameters: unknown[]): Promise<void>
}

// TODO: Implement selection
export const driver = await createSqliteDriver()
