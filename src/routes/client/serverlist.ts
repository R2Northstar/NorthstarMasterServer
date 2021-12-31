import { type FastifyPluginAsync } from 'fastify'
import { getGameServers, removeGameServer } from '../../shared/gameserver.js'

const register: FastifyPluginAsync = async (fastify, _) => {
  // exported routes

  // GET /client/servers
  // returns a list of available servers
  fastify.get('/client/servers', async () => {
    const displayServerArray = []
    const expiredServers = [] // Might be better to move this to another function at some point, but easiest to do here atm

    const servers = await getGameServers()

    for (const server of servers) {
      // Prune servers if they've had 30 seconds since last heartbeat
      if (Date.now() - server.lastHeartbeat > 30_000) {
        expiredServers.push(server)
        continue
      }

      // Don't show non-private_match servers on lobby since they'll pollute server list
      if (server.map === 'mp_lobby' && server.playlist !== 'private_match')
        continue

      // Create a copy of the gameserver obj for clients so we can hide sensitive info
      const copy = server.clean()

      displayServerArray.push(copy)
    }

    // Delete servers that we've marked for deletion
    await Promise.all(expiredServers.map(server => removeGameServer(server)))

    return displayServerArray
  })
}

export default register
