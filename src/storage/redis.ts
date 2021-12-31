import Redis from 'ioredis'
import { REDIS_CONN } from '~env/index.js'

const db = new Redis(REDIS_CONN, { lazyConnect: true })
export const redisHandle: () => Promise<Redis.Redis> = async () => {
  if (REDIS_CONN === undefined) {
    throw new Error('attempt to use Redis when disabled')
  }

  // Early return if ready
  if (db.status === 'ready') return db

  // Connect if not already
  if (db.status === 'wait') await db.connect()

  // Probably OK to return now
  return db
}
