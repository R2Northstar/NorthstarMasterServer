export type Row = Record<string, unknown>
export interface SQLDriver {
  query(query: string, parameters: unknown[]): Promise<Row[]>
  querySingle(query: string, parameters: unknown[]): Promise<Row | undefined>
  execute(query: string, parameters: unknown[]): Promise<void>
}
