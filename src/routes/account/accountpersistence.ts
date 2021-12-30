import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginCallback } from 'fastify'
import multipart from 'fastify-multipart'
import { GetGameServers } from '../../shared/gameserver.js'

const accounts = require('../../shared/accounts.js')

const register: FastifyPluginCallback = (fastify, options, done) => {
  fastify.register(multipart)

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
      const account = await accounts.AsyncGetPlayerByID(request.query.id)
      if (!account) return null

      // If the client is on their own server then don't check this since their own server might not be on masterserver
      if (account.currentServerId != 'self') {
        const server = GetGameServers()[request.query.serverId]
        // Dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
        if (
          !server ||
          request.ip != server.ip ||
          account.currentServerId != request.query.serverId
        )
          return null
      }

      // Mostly temp
      const buf = await (await request.file()).toBuffer()

      if (buf.length == account.persistentDataBaseline.length)
        await accounts.AsyncWritePlayerPersistenceBaseline(
          request.query.id,
          buf
        )

      return null
    }
  )

  done()
}

export default register
