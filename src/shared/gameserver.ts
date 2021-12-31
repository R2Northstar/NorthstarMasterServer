import { randomBytes } from 'node:crypto'

interface IGameServer {
  readonly id: string
  readonly serverAuthToken: string
  readonly name: string
  readonly description: string
  readonly playerCount: number
  readonly maxPlayers: number
  readonly map: string
  readonly playlist: string
  readonly ip: string
  readonly port: number
  readonly authPort: number
  readonly password: string
  readonly hasPassword: boolean
  readonly modInfo: Record<string, unknown>
  readonly lastHeartbeat: number
}

type CleanGameServer = Omit<
  IGameServer,
  'authToken' | 'ip' | 'port' | 'authPort' | 'password'
>

export class GameServer implements IGameServer {
  // #region Fields
  public readonly id: string
  public readonly serverAuthToken: string
  public name: string
  public description: string
  public playerCount: number
  public maxPlayers: number
  public map: string
  public playlist: string
  public readonly ip: string
  public readonly port: number
  public readonly authPort: number
  public readonly password: string
  public readonly hasPassword: boolean
  public modInfo: Record<string, unknown>
  public lastHeartbeat: number

  // #endregion

  // #region Constructor
  constructor(
    name: string,
    description: string,
    playerCount: number,
    maxPlayers: number,
    map: string,
    playlist: string,
    ip: string,
    port: number,
    authPort: number,
    password = '',
    modInfo = {}
  ) {
    this.id = randomBytes(16).toString('hex')
    this.serverAuthToken = randomBytes(16).toString('hex')
    this.name = name
    this.description = description
    this.playerCount = playerCount
    this.maxPlayers = maxPlayers
    this.map = map
    this.playlist = playlist
    this.ip = ip
    this.port = port
    this.authPort = authPort
    this.password = password
    this.hasPassword = Boolean(password)
    this.modInfo = modInfo
    this.lastHeartbeat = Date.now()
  }
  // #endregion

  // #region Methods
  public clean(): CleanGameServer {
    const clean: CleanGameServer = Object.freeze({
      id: this.id,
      name: this.name,
      description: this.description,
      playerCount: this.playerCount,
      maxPlayers: this.maxPlayers,
      map: this.map,
      playlist: this.playlist,
      hasPassword: this.hasPassword,
      modInfo: this.modInfo,
			hasPassword: Boolean(this.password),
      lastHeartbeat: this.lastHeartbeat,
    })

    return clean
  }
  // #endregion
}

type MaybePromise<T> = T | PromiseLike<T>

interface GameServerManager {
  getGameServers(): MaybePromise<readonly GameServer[]>
  getGameServer(id: string): MaybePromise<GameServer | undefined>
  addGameServer(server: GameServer): MaybePromise<void>
  removeGameServer(server: GameServer): MaybePromise<void>
}

const createLocalManager: () => GameServerManager = () => {
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

const { getGameServer, getGameServers, addGameServer, removeGameServer } =
  createLocalManager()

export { getGameServer, getGameServers, addGameServer, removeGameServer }
