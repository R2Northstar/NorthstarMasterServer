import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginAsync } from 'fastify'
import { getGameServer, removeGameServer } from '../../gameservers/index.js'

// DELETE /server/remove_server
// removes a gameserver from the server list

const register: FastifyPluginAsync = async (fastify, _) => {
  const RemoveServerQuery = Type.Object({
    id: Type.String(),
  })

  fastify.delete<{ Querystring: Static<typeof RemoveServerQuery> }>(
    '/server/remove_server',
    {
      schema: {
        querystring: RemoveServerQuery,
      },
    },
    async (request, response) => {
      const server = await getGameServer(request.query.id)
      // Dont remove if the server doesnt exist, or the server isnt the one sending the heartbeat
      if (!server || request.ip !== server.ip) return null

      await removeGameServer(server)
      await response.code(204).send()
    }
  )
}

export default register
