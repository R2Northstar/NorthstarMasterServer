import { Decoder, Encoder } from '@msgpack/msgpack'
import { type Buffer } from 'node:buffer'
import { CACHE_GAME_SERVERS } from '~env/index.js'
import { redisHandle } from '~storage/redis.js'
import { GameServer } from '../gameserver.js'
import { type GameServerManager } from '../manager.js'

export const createRedisManager: () => Promise<GameServerManager> =
  async () => {
    const { db, pubsub } = await redisHandle()

    const encoder = new Encoder()
    const decoder = new Decoder()

    const methods: GameServerManager = {
      async getGameServers() {
        const servers: GameServer[] = []
        const scan = db.scanStream({ match: 'northstar:server:*', count: 100 })

        for await (const keys of scan) {
          const p = db.pipeline()
          for (const key of keys) {
            p.getBuffer(key)
          }

          const results = await p.exec()
          const errors = results.map(([error]) => error)

          const hasError = errors.find(x => x !== null)
          if (hasError) throw hasError

          const buffers = results.map(([_, buf]) => buf as Buffer)
          const decoded = buffers.map(buf => GameServer.decode(buf, decoder))

          servers.push(...decoded)
        }

        return servers
      },

      async getGameServer(id) {
        const buf = await db.getBuffer(`northstar:server:${id}`)
        if (buf === null) return undefined

        const gameserver = GameServer.decode(buf, decoder)
        return gameserver
      },

      async addGameServer(server) {
        const serialized = server.encode(encoder)
        await db.set(`northstar:server:${server.id}`, serialized)

        if (CACHE_GAME_SERVERS) {
          await pubsub.publish(`northstar:servers`, 'add')
        }
      },

      async removeGameServer(server) {
        await db.del(`northstar:server:${server.id}`)

        if (CACHE_GAME_SERVERS) {
          await pubsub.publish(`northstar:servers`, 'remove')
        }
      },

      async removeMultipleServers(...servers) {
        const keys = servers.map(x => `northstar:server:${x.id}`)
        await db.del(...keys)

        if (CACHE_GAME_SERVERS) {
          await pubsub.publish(`northstar:servers`, 'remove')
        }
      },
    }

    return Object.freeze(methods)
  }
