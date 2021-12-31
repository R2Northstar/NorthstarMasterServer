import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import { type FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { getById as getAccountById } from '~accounts/index.js'
import { REQUIRE_SESSION_TOKEN } from '~env/index.js'
import { getGameServer } from '~gameservers/index.js'

// POST /client/auth_with_server
// attempts to authenticate a client with a gameserver, so they can connect
// authentication includes giving them a 1-time token to join the gameserver, as well as sending their persistent data to the gameserver

const register: FastifyPluginAsync = async (fastify, _) => {
  const AuthWithServerQuery = Type.Object({
    // Id of the player trying to auth
    id: Type.String(),

    // Not implemented yet: the authing player's account token
    playerToken: Type.String(),

    // Server id being authed against
    server: Type.String(),

    // The password the player is using to connect to the server
    password: Type.String(),
  })

  fastify.post<{ Querystring: Static<typeof AuthWithServerQuery> }>(
    '/client/auth_with_server',
    {
      schema: {
        querystring: AuthWithServerQuery,
      },
    },
    async request => {
      const server = await getGameServer(request.query.server)

      if (
        !server ||
        (server.hasPassword && request.query.password !== server.password)
      ) {
        return { success: false }
      }

      const account = await getAccountById(request.query.id)
      if (account === undefined) return { success: false }
      if (account.isBanned) {
        return { success: false }
      }

      if (REQUIRE_SESSION_TOKEN) {
        // Check token
        if (request.query.playerToken !== account.authToken) {
          return { success: false }
        }

        // Check expired token
        if (account.tokenExpired()) {
          return { success: false }
        }
      }

      // Fix this: game doesnt seem to set serverFilter right if it's >31 chars long, so restrict it to 31
      const authToken = crypto.randomBytes(16).toString('hex').slice(0, 31)

      // TODO: build persistent data here, rather than sending baseline only
      // server.modInfo.Mods.filter(m => Boolean(m.pdiff)).map(m => m.pdiff)
      const pdata = account.persistentDataBaseline

      const parameters = new URLSearchParams()
      parameters.set('id', request.query.id)
      parameters.set('authToken', authToken)
      parameters.set('serverAuthToken', server.serverAuthToken)

      try {
        const { data } = await axios.post<{ success: boolean }>(
          `http://${server.ip}:${server.authPort}/authenticate_incoming_player`,
          pdata,
          { params: parameters }
        )

        if (!data.success) return { success: false }
      } catch {
        return { success: false }
      }

      return {
        success: true,

        ip: server.ip,
        port: server.port,
        authToken,
      }
    }
  )
}

export default register
