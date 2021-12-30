import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import Filter from 'bad-words'
import { type FastifyPluginAsync } from 'fastify'
import multipart from 'fastify-multipart'
import crypto from 'node:crypto'
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
    port: Type.Integer(),

    // The port the server's http auth server is being hosted on
    authPort: Type.Integer(),

    // The name of the server
    name: Type.String(),

    // The description of the server
    description: Type.String(),

    // The map the server is on
    map: Type.String(),

    // The playlist the server is using
    playlist: Type.String(),

    // The maximum number of players the server accepts
    maxPlayers: Type.Integer(),

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
    async (request, reply) => {
      // Check server's verify endpoint on their auth server, make sure it's fine
      // in the future we could probably check the server's connect port too, with a c2s_connect packet or smth, but atm this is good enough

      let hasValidModInfo = true
      let modInfo

      if (request.isMultipart()) {
        try {
          modInfo = JSON.parse(
            (await (await request.file()).toBuffer()).toString()
          )
          hasValidModInfo = Array.isArray(modInfo.Mods)
        } catch {}
      }

      // TODO: Handle errors
      const { data: authServerResponse } = await axios.get<string>(
        `http://${request.ip}:${request.query.authPort}/verify`,
        { responseType: 'text' }
      )

      if (!authServerResponse || authServerResponse.toString() != VERIFY_STRING)
        return { success: false }

      // Pdiff stuff
      if (modInfo && modInfo.Mods) {
        for (const mod of modInfo.Mods) {
          if (mod.pdiff) {
            try {
              const pdiffHash = crypto
                .createHash('sha1')
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
        request.query.description == ''
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
      addGameServer(newServer)

      return {
        success: true,
        id: newServer.id,
      }
    }
  )

  const HeartbeatQuery = Type.Object({
    // The id of the server sending this message
    id: Type.String(),
    playerCount: Type.Integer(),
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
    async (request, reply) => {
      const server = getGameServer(request.query.id)
      // Dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
      if (!server || request.ip !== server.ip || !request.query.id) {
        // Remove !request.playerCount as if playercount==0 it will trigger skip heartbeat update
        return null
      } // Added else so update heartbeat will trigger,Have to add the brackets for me to work for some reason

      server.lastHeartbeat = Date.now()
      server.playerCount = request.query.playerCount
      return null
    }
  )

  // POST /server/update_values
  // updates values shown on the server list, such as map, playlist, or player count
  // no schema for this one, since it's fully dynamic and fastify doesnt do optional params
  fastify.post('/server/update_values', async (request, reply) => {
    if (!('id' in request.query)) return null

    const server = getGameServer(request.query.id)
    // Dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
    if (!server || request.ip !== server.ip) return null

    for (const key of Object.keys(request.query)) {
      if (key === 'id' || !(key in server)) continue

      if (key === 'playerCount' || key === 'maxPlayers') {
        server[key] = Number.parseInt(request.query[key])
      } // I suppose maybe add the brackets here to as upper one works with it. but actually its fine not to i guess.
      else {
        server[key] = request.query[key]
      }
    }

    return null
  })

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
    async request => {
      const server = getGameServer(request.query.id)
      // Dont remove if the server doesnt exist, or the server isnt the one sending the heartbeat
      if (!server || request.ip !== server.ip) return null

      removeGameServer(server)
      return null
    }
  )
}

export default register
