import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginAsync } from 'fastify'
import multipart from 'fastify-multipart'
import * as accounts from '../../shared/accounts.js'
import { getGameServer } from '../../shared/gameserver.js'

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(multipart)

  // exported routes

  const WritePersistenceQuery = Type.Object({
    id: Type.String(),
    serverId: Type.String(),
  })

  // POST /accounts/write_persistence
  // attempts to write persistent data for a player
  // note: this is entirely insecure atm, at the very least, we should prevent it from being called on servers that the account being written to isn't currently connected to
  fastify.post<{ Querystring: Static<typeof WritePersistenceQuery> }>(
    '/accounts/write_persistence',
    {
      schema: {
        querystring: WritePersistenceQuery,
      },
    },
    async (request, response) => {
      // Check if account exists
      const account = await accounts.asyncGetPlayerByID(request.query.id)
      if (!account) {
        await response.code(204).send()
        return
      }

      // If the client is on their own server then don't check this since their own server might not be on masterserver
      if (account.currentServerId !== 'self') {
        const server = await getGameServer(request.query.serverId)
        // Dont update if the server doesnt exist, or the server isnt the one sending the write
        if (
          !server ||
          request.ip !== server.ip ||
          account.currentServerId !== request.query.serverId
        ) {
          await response.code(204).send()
          return
        }
      }

      // Mostly temp
      const file = await request.file()
      const buf = await file.toBuffer()

      if (buf.length === account.persistentDataBaseline.length) {
        await accounts.asyncWritePlayerPersistenceBaseline(
          request.query.id,
          buf
        )
      }

      await response.code(204).send()
    }
  )
}

export default register
