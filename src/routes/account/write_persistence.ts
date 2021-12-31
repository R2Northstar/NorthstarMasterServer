import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginAsync } from 'fastify'
import multipart from 'fastify-multipart'
import { getById as getAccountById } from '../../accounts/index.js'
import { getGameServer } from '../../gameservers/index.js'

// POST /accounts/write_persistence
// attempts to write persistent data for a player
// note: this is entirely insecure atm, at the very least, we should prevent it from being called on servers that the account being written to isn't currently connected to

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(multipart)

  const WritePersistenceQuery = Type.Object({
    id: Type.String(),
    serverId: Type.String(),
  })

  fastify.post<{ Querystring: Static<typeof WritePersistenceQuery> }>(
    '/accounts/write_persistence',
    {
      schema: {
        querystring: WritePersistenceQuery,
      },
    },
    async (request, response) => {
      const account = await getAccountById(request.query.id)
      if (account === undefined) {
        await response.code(204).send()
        return
      }

      // If the client is on their own server then don't check this since their own server might not be on masterserver
      if (account.currentServerID !== 'self') {
        const server = await getGameServer(request.query.serverId)
        if (server === undefined) {
          await response.code(204).send()
          return
        }

        const isCorrectServer = request.ip !== server.ip
        const isCurrentServer =
          account.currentServerID === request.query.serverId

        if (!isCorrectServer || !isCurrentServer) {
          await response.code(204).send()
          return
        }
      }

      // Mostly temp
      const file = await request.file()
      const buf = await file.toBuffer()

      if (buf.length === account.persistentDataBaseline.length) {
        await account.updatePersistentDataBaseline(buf)
      }

      await response.code(204).send()
    }
  )
}

export default register
