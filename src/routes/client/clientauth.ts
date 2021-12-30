import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import { type FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { REQUIRE_SESSION_TOKEN } from '../../env/index.js'
import * as accounts from '../../shared/accounts.js'
import { getGameServer } from '../../shared/gameserver.js'

const register: FastifyPluginAsync = async (fastify, _) => {
  // exported routes

  const OriginAuthQuery = Type.Object({
    // The authing player's id
    id: Type.String(),

    // The authing player's origin token
    token: Type.String(),
  })

  // POST /client/origin_auth
  // used to authenticate a user on northstar, so we know the person using their uid is really them
  // returns the user's northstar session token
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

  // POST /client/auth_with_server
  // attempts to authenticate a client with a gameserver, so they can connect
  // authentication includes giving them a 1-time token to join the gameserver, as well as sending their persistent data to the gameserver
  fastify.post<{ Querystring: Static<typeof AuthWithServerQuery> }>(
    '/client/auth_with_server',
    {
      schema: {
        querystring: AuthWithServerQuery,
      },
    },
    async request => {
      const server = getGameServer(request.query.server)

      if (
        !server ||
        (server.hasPassword && request.query.password !== server.password)
      ) {
        return { success: false }
      }

      const account = await accounts.asyncGetPlayerByID(request.query.id)
      if (!account) return { success: false }

      if (REQUIRE_SESSION_TOKEN) {
        // Check token
        if (request.query.playerToken !== account.currentAuthToken) {
          return { success: false }
        }

        // Check expired token
        if (account.currentAuthTokenExpirationTime < Date.now()) {
          return { success: false }
        }
      }

      // Fix this: game doesnt seem to set serverFilter right if it's >31 chars long, so restrict it to 31
      const authToken = crypto.randomBytes(16).toString('hex').slice(0, 31)

      // TODO: build persistent data here, rather than sending baseline only
      const pdata = await accounts.asyncGetPlayerPersistenceBufferForMods(
        request.query.id,
        server.modInfo.Mods.filter(m => Boolean(m.pdiff)).map(m => m.pdiff)
      )

      const parameters = new URLSearchParams()
      parameters.set('id', request.query.id)
      parameters.set('authToken', authToken)
      parameters.set('serverAuthToken', server.serverAuthToken)

      // TODO: handle errors
      const { data: authResponse } = await axios.post<string>(
        `http://${server.ip}:${server.authPort}/authenticate_incoming_player`,
        pdata,
        // TODO: Native JSON parsing
        { responseType: 'text', params: parameters }
      )

      if (!authResponse) return { success: false }

      const jsonResponse = authResponse as unknown as Record<string, unknown>
      if (!jsonResponse.success) return { success: false }

      return {
        success: true,

        ip: server.ip,
        port: server.port,
        authToken,
      }
    }
  )

  const AuthWithSelfQuery = Type.Object({
    // Id of the player trying to auth
    id: Type.String(),

    // Not implemented yet: the authing player's account token
    playerToken: Type.String(),
  })

  // POST /client/auth_with_self
  // attempts to authenticate a client with their own server, before the server is created
  // note: atm, this just sends pdata to clients and doesn't do any kind of auth stuff, potentially rewrite later
  fastify.post<{ Querystring: Static<typeof AuthWithSelfQuery> }>(
    '/client/auth_with_self',
    {
      schema: {
        querystring: AuthWithSelfQuery,
      },
    },
    async request => {
      const account = await accounts.asyncGetPlayerByID(request.query.id)
      if (!account) {
        return { success: false }
      }

      if (REQUIRE_SESSION_TOKEN) {
        // Check token
        if (request.query.playerToken !== account.currentAuthToken) {
          return { success: false }
        }

        // Check expired token
        if (account.currentAuthTokenExpirationTime < Date.now()) {
          return { success: false }
        }
      }

      // Fix this: game doesnt seem to set serverFilter right if it's >31 chars long, so restrict it to 31
      const authToken = crypto.randomBytes(16).toString('hex').slice(0, 31)
      await accounts.asyncUpdatePlayerCurrentServer(account.id, 'self') // Bit of a hack: use the "self" id for local servers

      return {
        success: true,

        id: account.id,
        authToken,
        // This fucking sucks, but i couldn't get game to behave if i sent it as an ascii string, so using this for now
        persistentData: Array.from(
          new Uint8Array(account.persistentDataBaseline)
        ),
      }
    }
  )
}

export default register
