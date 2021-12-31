import { type Static, Type } from '@sinclair/typebox'
import { type FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { getById as getAccountById } from '~accounts/index.js'
import { REQUIRE_SESSION_TOKEN } from '~env/index.js'

// POST /client/auth_with_self
// attempts to authenticate a client with their own server, before the server is created
// note: atm, this just sends pdata to clients and doesn't do any kind of auth stuff, potentially rewrite later

const register: FastifyPluginAsync = async (fastify, _) => {
  const AuthWithSelfQuery = Type.Object({
    // Id of the player trying to auth
    id: Type.String(),

    // Not implemented yet: the authing player's account token
    playerToken: Type.String(),
  })

  fastify.post<{ Querystring: Static<typeof AuthWithSelfQuery> }>(
    '/client/auth_with_self',
    {
      schema: {
        querystring: AuthWithSelfQuery,
      },
    },
    async request => {
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
      // Bit of a hack: use the "self" id for local servers
      await account.updateCurrentServer('self')

      return {
        success: true,

        id: account.id,
        authToken,
        // This fucking sucks, but i couldn't get game to behave if i sent it as an ascii string, so using this for now
        persistentData: [...new Uint8Array(account.persistentDataBaseline)],
      }
    }
  )
}

export default register
