import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import { type FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { REQUIRE_SESSION_TOKEN } from '../../env/index.js'
import * as accounts from '../../shared/accounts.js'

// POST /client/origin_auth
// used to authenticate a user on northstar, so we know the person using their uid is really them
// returns the user's northstar session token

const register: FastifyPluginAsync = async (fastify, _) => {
  // exported routes

  const OriginAuthQuery = Type.Object({
    // The authing player's id
    id: Type.String(),

    // The authing player's origin token
    token: Type.String(),
  })

  fastify.get<{ Querystring: Static<typeof OriginAuthQuery> }>(
    '/client/origin_auth',
    {
      schema: {
        querystring: OriginAuthQuery,
      },
    },
    async request => {
      // Only do this if we're in an environment that actually requires session tokens
      if (REQUIRE_SESSION_TOKEN) {
        // TODO: we should find origin endpoints that can verify game tokens so we don't have to rely on stryder for this in case of a ratelimit
        if (request.query.token.includes('&')) return { success: false }

        const parameters = new URLSearchParams()
        parameters.set('qt', 'origin-requesttoken')
        parameters.set('type', 'server_token')
        parameters.set('code', request.query.token)
        parameters.set('forceTrial', '0')
        parameters.set('proto', '0')
        parameters.set('json', '1')
        parameters.set('env', 'production')
        parameters.set(
          'userId',
          Number.parseInt(request.query.id, 10).toString(16).toUpperCase()
        )

        interface AuthResponse {
          token: string
          hasOnlineAccess: string
          expiry: string
          storeUri: string
        }

        const { data: authJson } = await axios.get<AuthResponse>(
          'https://r2-pc.stryder.respawn.com/nucleus-oauth.php',
          { params: parameters }
        )

        // Check origin auth was fine
        // unsure if we can check the exact value of storeUri? doing an includes check just in case
        const hasOnlineAccess = authJson.hasOnlineAccess === '1'
        const ownsGame = authJson.storeUri.includes('titanfall-2')

        if (!hasOnlineAccess || !ownsGame) {
          return { success: false }
        }
      }

      let account = await accounts.asyncGetPlayerByID(request.query.id)
      if (!account) {
        // Create account for user
        await accounts.asyncCreateAccountForID(request.query.id)
        account = await accounts.asyncGetPlayerByID(request.query.id)
      }

      const authToken = crypto.randomBytes(16).toString('hex')
      await accounts.asyncUpdateCurrentPlayerAuthToken(account.id, authToken)

      return {
        success: true,
        token: authToken,
      }
    }
  )
}

export default register
