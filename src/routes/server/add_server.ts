import { type Static, Type } from '@sinclair/typebox'
import axios from 'axios'
import Filter from 'bad-words'
import { type FastifyPluginAsync } from 'fastify'
import multipart from 'fastify-multipart'
import { createHash } from 'node:crypto'
import { VERIFY_STRING } from '~constants.js'
import { addGameServer, GameServer } from '~gameservers/index.js'
import * as pjson from '../../shared/pjson.js'

const filter = new Filter()

// POST /server/add_server
// adds a gameserver to the server list

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(multipart)

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

              mod.pdiff = pjson.ParseDefinitionDiff(mod.pdiff)
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

      // Name,
      // description,
      // 0,
      // request.query.maxPlayers,
      // request.query.map,
      // request.query.playlist,
      // request.ip,
      // request.query.port,
      // request.query.authPort,
      // request.query.password,
      // modInfo

      const newServer = new GameServer({
        name,
        description,
        playerCount: 0,
        maxPlayers: request.query.maxPlayers,
        map: request.query.map,
        playlist: request.query.playlist,
        ip: request.ip,
        port: request.query.port,
        authPort: request.query.authPort,
        password: request.query.password,
        // TODO: Strongly type
        modInfo: modInfo as Record<string, unknown>,
      })

      await addGameServer(newServer)

      return {
        success: true,
        id: newServer.id,
        serverAuthToken: newServer.serverAuthToken,
      }
    }
  )
}

export default register
