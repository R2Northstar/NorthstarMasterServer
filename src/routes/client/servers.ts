import { type FastifyPluginAsync } from 'fastify'
import cors from 'fastify-cors'
import {
  type CleanGameServer,
  type GameServer,
  getGameServers,
  removeGameServer,
} from '~gameservers/index.js'

// GET /client/servers
// returns a list of available servers

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(cors)

  fastify.get('/client/servers', async () => {
    const cleanServers: CleanGameServer[] = []
    const expiredServers: GameServer[] = [] // TODO: Move to a mark and sweep system

    const servers = await getGameServers()
    for (const server of servers) {
      // Prune servers if they've had 30 seconds since last heartbeat
      if (Date.now() - server.lastHeartbeat > 30_000) {
        expiredServers.push(server)
        continue
      }

      // Don't show non-private_match servers on lobby since they'll pollute server list
      if (server.map === 'mp_lobby' && server.playlist !== 'private_match') {
        continue
      }

      // Remove sensitive info from server
      const copy = server.clean()
      cleanServers.push(copy)
    }

    // Delete servers that we've marked for deletion
    await Promise.all(expiredServers.map(server => removeGameServer(server)))

    return cleanServers
  })
}

export default register
