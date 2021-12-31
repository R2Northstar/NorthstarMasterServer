import { type GameServer } from './gameserver.js'

type MaybePromise<T> = T | PromiseLike<T>

export interface GameServerManager {
  getGameServers(): MaybePromise<readonly GameServer[]>
  getGameServer(id: string): MaybePromise<GameServer | undefined>
  addGameServer(server: GameServer): MaybePromise<void>
  removeGameServer(server: GameServer): MaybePromise<void>
  removeMultipleServers(...servers: GameServer[]): MaybePromise<void>
}
