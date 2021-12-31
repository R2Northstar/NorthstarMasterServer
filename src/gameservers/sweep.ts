import { SYNC_GAME_SERVERS } from '~env/index.js'
import { redisHandle } from '~storage/redis.js'
import { getGameServers, removeMultipleServers } from './index.js'

const LOCK_KEY = 'northstar:lock:sweep'

const isLocked = async () => {
  if (SYNC_GAME_SERVERS === false) return false

  const { db } = await redisHandle()
  const exists = await db.exists(LOCK_KEY)

  return exists === 1
}

const lock = async () => {
  if (SYNC_GAME_SERVERS === false) {
    return async () => {
      // No-op
    }
  }

  const { db } = await redisHandle()
  await db.set(LOCK_KEY, '1')

  return async () => {
    await db.del(LOCK_KEY)
  }
}

export const sweepGameServers = async () => {
  // Check for others holding the lock
  const locked = await isLocked()
  if (locked) {
    console.warn('not sweeping, db is locked')
    return
  }

  // Aquire the lock ourselves
  const release = await lock()
  try {
    const servers = await getGameServers()
    const expired = servers.filter(x => x.hasExpired())

    // Remove all servers
    if (expired.length > 0) {
      await removeMultipleServers(...expired)
    }
  } finally {
    await release()
  }
}
