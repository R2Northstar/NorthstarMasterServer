import Redis from 'ioredis'
import { REDIS_CONN } from '~env/index.js'

const db = new Redis(REDIS_CONN, { lazyConnect: true })
const pubsub = new Redis(REDIS_CONN, { lazyConnect: true })

interface RedisHandles {
  db: Redis.Redis
  pubsub: Redis.Redis
}

export const redisHandle: () => Promise<RedisHandles> = async () => {
  if (REDIS_CONN === undefined) {
    throw new Error('attempt to use Redis when disabled')
  }

  // Early return if ready
  if (db.status === 'ready' && pubsub.status === 'ready') {
    return { db, pubsub }
  }

  // Connect if not already
  if (db.status === 'wait') await db.connect()
  if (pubsub.status === 'wait') await pubsub.connect()

  // Probably OK to return now
  return { db, pubsub }
}
