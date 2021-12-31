import { localServerManager } from './managers/local.js'

// Conditionally switch exports
const activeManager = localServerManager

// eslint-disable-next-line prettier/prettier
const { getGameServers, getGameServer, addGameServer, removeGameServer } = activeManager
export { getGameServers, getGameServer, addGameServer, removeGameServer }

export { GameServer, CleanGameServer, ModInfo, Mod } from './gameserver.js'
