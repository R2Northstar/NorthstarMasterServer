import Redis from 'ioredis'
import { REDIS_CONN } from '~env/index.js'

const db = new Redis(REDIS_CONN, { lazyConnect: true })
const sub = new Redis(REDIS_CONN, { lazyConnect: true })

interface RedisHandles {
  db: Redis.Redis
  sub: Redis.Redis
}

export const redisHandle: () => Promise<RedisHandles> = async () => {
  if (REDIS_CONN === undefined) {
    throw new Error('attempt to use Redis when disabled')
  }

  // Early return if ready
  if (db.status === 'ready' && sub.status === 'ready') {
    return { db, sub }
  }

  // Connect if not already
  if (db.status === 'wait') await db.connect()
  if (sub.status === 'wait') await sub.connect()

  // Probably OK to return now
  return { db, sub }
}
