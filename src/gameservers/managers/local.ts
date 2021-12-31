import { type GameServer } from '../gameserver.js'
import { type GameServerManager } from '../manager.js'

export const createLocalManager: () => GameServerManager = () => {
  const gameServers = new Map<string, GameServer>()
  const methods: GameServerManager = {
    async getGameServers() {
      const servers = [...gameServers.values()]
      return Object.freeze(servers)
    },

    async getGameServer(id) {
      return gameServers.get(id)
    },

    async addGameServer(server) {
      gameServers.set(server.id, server)
    },

    async removeGameServer(server) {
      gameServers.delete(server.id)
    },
  }

  return Object.freeze(methods)
}
