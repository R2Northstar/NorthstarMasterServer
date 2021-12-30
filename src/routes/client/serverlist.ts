import { type FastifyPluginCallback } from 'fastify'
import {
  GameServer,
  GetGameServers,
  RemoveGameServer,
} from '../../shared/gameserver.js'

const path = require('path')

const register: FastifyPluginCallback = (fastify, options, done) => {
  // exported routes

  // GET /client/servers
  // returns a list of available servers
  fastify.get('/client/servers', async (request, response) => {
    const displayServerArray = []
    const expiredServers = [] // Might be better to move this to another function at some point, but easiest to do here atm

    const servers = Object.values(GetGameServers())

    for (const server of servers) {
      // Prune servers if they've had 30 seconds since last heartbeat
      if (Date.now() - server.lastHeartbeat > 30_000) {
        expiredServers.push(server)
        continue
      }

      // Don't show non-private_match servers on lobby since they'll pollute server list
      if (server.map == 'mp_lobby' && server.playlist != 'private_match')
        continue

      // Create a copy of the gameserver obj for clients so we can hide sensitive info
      const copy = server.clean()

      displayServerArray.push(copy)
    }

    // Delete servers that we've marked for deletion
    for (const server of expiredServers) {
      RemoveGameServer(server)
    }

    return displayServerArray
  })

  done()
}

export default register
