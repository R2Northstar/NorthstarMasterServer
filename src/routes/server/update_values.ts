import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginAsync } from 'fastify'
import { getGameServer } from '../../shared/gameserver.js'

// POST /server/update_values
// updates values shown on the server list, such as map, playlist, or player count
// no schema for this one, since it's fully dynamic and fastify doesnt do optional params

const register: FastifyPluginAsync = async (fastify, _) => {
  const UpdateValuesQuery = Type.Object({
    // The id of the server sending this message
    id: Type.String(),

    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    playerCount: Type.Optional(Type.Integer({ minimum: 0 })),
    maxPlayers: Type.Optional(Type.Integer({ minimum: 0 })),
    map: Type.Optional(Type.String()),
    playlist: Type.Optional(Type.String()),
  })

  fastify.post<{ Querystring: Static<typeof UpdateValuesQuery> }>(
    '/server/update_values',
    async (request, response) => {
      const server = await getGameServer(request.query.id)
      if (!server || request.ip !== server.ip) {
        await response.code(204).send()
        return
      }

      /* eslint-disable prettier/prettier */
      if (request.query.name) server.name = request.query.name
      if (request.query.description) server.description = request.query.description
      if (request.query.playerCount) server.playerCount = request.query.playerCount
      if (request.query.maxPlayers) server.maxPlayers = request.query.maxPlayers
      if (request.query.map) server.map = request.query.map
      if (request.query.playlist) server.playlist = request.query.playlist
      /* eslint-enable prettier/prettier */

      await response.code(204).send()
    }
  )
}

export default register
