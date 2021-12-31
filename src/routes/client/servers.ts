import { type FastifyPluginAsync } from 'fastify'
import cors from 'fastify-cors'
import { CACHE_GAME_SERVERS } from '~env/index.js'
import { type CleanGameServer, getGameServers } from '~gameservers/index.js'
import { redisHandle } from '~storage/redis.js'

// GET /client/servers
// returns a list of available servers

interface Cache {
  stale: boolean
  data: CleanGameServer[]
}

const cache: Cache = {
  stale: true,
  data: [],
}

// Invalidate cache on server modification
if (CACHE_GAME_SERVERS) {
  const { sub } = await redisHandle()

  await sub.subscribe('northstar:servers')
  sub.on('message', channel => {
    if (channel !== 'northstar:servers') return

    // Invalidate cache
    cache.stale = true
  })
}

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(cors)

  fastify.get('/client/servers', async () => {
    if (CACHE_GAME_SERVERS && !cache.stale) {
      return cache.data
    }

    const servers = await getGameServers()
    const filtered = servers.filter(
      server => server.map !== 'mp_lobby' || server.playlist === 'private_match'
    )

    const cleaned = filtered.map(x => x.clean())
    if (CACHE_GAME_SERVERS) {
      cache.stale = false
      cache.data = cleaned
    }

    return cleaned
  })
}

export default register
