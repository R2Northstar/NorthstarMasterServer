import { type FastifyPluginAsync } from 'fastify'
import cors from 'fastify-cors'
import { getGameServers } from '~gameservers/index.js'

// GET /client/servers
// returns a list of available servers

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(cors)

  fastify.get('/client/servers', async () => {
    const servers = await getGameServers()
    const filtered = servers.filter(
      server => server.map !== 'mp_lobby' || server.playlist === 'private_match'
    )

    return filtered.map(x => x.clean())
  })
}

export default register
