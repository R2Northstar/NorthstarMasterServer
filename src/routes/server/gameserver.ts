import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import Filter from 'bad-words'
import { type FastifyPluginAsync } from 'fastify'
import multipart from 'fastify-multipart'
import { createHash } from 'node:crypto'
import {
  addGameServer,
  GameServer,
  getGameServer,
  removeGameServer,
} from '../../shared/gameserver.js'
import * as pjson from '../../shared/pjson.js'

const filter = new Filter()

const VERIFY_STRING = 'I am a northstar server!'

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(multipart)

  // exported routes

  const AddServerQuery = Type.Object({
    // The port the gameserver is being hosted on ( for connect )
    port: Type.Integer({ minimum: 1, maximum: 65_535 }),

    // The port the server's http auth server is being hosted on
    authPort: Type.Integer({ minimum: 1, maximum: 65_535 }),

    // The name of the server
    name: Type.String(),

    // The description of the server
    description: Type.String(),

    // The map the server is on
    map: Type.String(),

    // The playlist the server is using
    playlist: Type.String(),

    // The maximum number of players the server accepts
    maxPlayers: Type.Integer({ minimum: 0 }),

    // The server's password, if 0 length, the server does not accept a password
    password: Type.String(),
  })

  // POST /server/add_server
  // adds a gameserver to the server list
  fastify.post<{ Querystring: Static<typeof AddServerQuery> }>(
    '/server/add_server',
    {
      schema: {
        querystring: AddServerQuery,
      },
    },
    async request => {
      // Check server's verify endpoint on their auth server, make sure it's fine
      // in the future we could probably check the server's connect port too, with a c2s_connect packet or smth, but atm this is good enough

      let hasValidModInfo = true
      let modInfo

      if (request.isMultipart()) {
        try {
          const file = await request.file()
          const buffer = await file.toBuffer()

          modInfo = JSON.parse(buffer.toString('utf8'))
          hasValidModInfo = Array.isArray(modInfo.Mods)
        } catch {}
      }

      try {
        const { data: authServerResponse } = await axios.get<string>(
          `http://${request.ip}:${request.query.authPort}/verify`,
          { responseType: 'text' }
        )

        if (authServerResponse !== VERIFY_STRING) {
          return { success: false }
        }
      } catch {
        return { success: false }
      }

      // Pdiff stuff
      if (modInfo?.Mods) {
        for (const mod of modInfo.Mods) {
          if (mod.pdiff) {
            try {
              const pdiffHash = createHash('sha1')
                .update(mod.pdiff)
                .digest('hex')

              mod.pdiff = pjson.ParseDefinitionDiffs(mod.pdiff)
              mod.pdiff.hash = pdiffHash
            } catch {
              mod.pdiff = null
            }
          }
        }
      }

      const name = filter.clean(request.query.name)
      const description =
        request.query.description === ''
          ? ''
          : filter.clean(request.query.description)

      const newServer = new GameServer(
        name,
        description,
        0,
        request.query.maxPlayers,
        request.query.map,
        request.query.playlist,
        request.ip,
        request.query.port,
        request.query.authPort,
        request.query.password,
        modInfo
      )

      await addGameServer(newServer)

      return {
        success: true,
        id: newServer.id,
        serverAuthToken: newServer.serverAuthToken,
      }
    }
  )

  const HeartbeatQuery = Type.Object({
    // The id of the server sending this message
    id: Type.String(),
    playerCount: Type.Integer({ minimum: 0 }),
  })

  // POST /server/heartbeat
  // refreshes a gameserver's last heartbeat time, gameservers are removed after 30 seconds without a heartbeat
  fastify.post<{ Querystring: Static<typeof HeartbeatQuery> }>(
    '/server/heartbeat',
    {
      schema: {
        querystring: HeartbeatQuery,
      },
    },
    async (request, response) => {
      const server = await getGameServer(request.query.id)
      if (!server || request.ip !== server.ip) {
        return null
      }

      server.lastHeartbeat = Date.now()
      server.playerCount = request.query.playerCount

      return null
    }
  )

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

  // POST /server/update_values
  // updates values shown on the server list, such as map, playlist, or player count
  // no schema for this one, since it's fully dynamic and fastify doesnt do optional params
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

  const RemoveServerQuery = Type.Object({
    id: Type.String(),
  })

  // DELETE /server/remove_server
  // removes a gameserver from the server list
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
