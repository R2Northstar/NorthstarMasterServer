import { type Knex } from 'knex'

export type Row = Record<string, unknown>
export interface SQLDriver {
  readonly builder: Knex

  query(query: string, parameters: unknown[]): Promise<Row[]>
  querySingle(query: string, parameters: unknown[]): Promise<Row | undefined>
  execute(query: string, parameters: unknown[]): Promise<void>
}
