import { SYNC_GAME_SERVERS } from '~env/index.js'
import { createLocalManager } from './managers/local.js'
import { createRedisManager } from './managers/redis.js'

// Conditionally switch exports
const activeManager = SYNC_GAME_SERVERS
  ? await createRedisManager()
  : createLocalManager()

// eslint-disable-next-line prettier/prettier
const { getGameServers, getGameServer, addGameServer, removeGameServer } = activeManager
export { getGameServers, getGameServer, addGameServer, removeGameServer }

export { GameServer, CleanGameServer, ModInfo, Mod } from './gameserver.js'
