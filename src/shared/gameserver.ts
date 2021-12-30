import { randomBytes } from 'node:crypto'

interface IGameServer {
  readonly id: string
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
  readonly modInfo: Record<string, unknown>
  readonly lastHeartbeat: number
}

type CleanGameServer = Omit<
  IGameServer,
  'ip' | 'port' | 'authPort' | 'password'
>

export class GameServer implements IGameServer {
  // #region Backing Fields
  private readonly _id: string
  private readonly _name: string
  private readonly _description: string
  private readonly _playerCount: number
  private readonly _maxPlayers: number
  private readonly _map: string
  private readonly _playlist: string
  private readonly _ip: string
  private readonly _port: number
  private readonly _authPort: number
  private readonly _password: string
  private readonly _modInfo: Record<string, unknown>
  private readonly _lastHeartbeat: number
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
    this._id = randomBytes(16).toString('hex')
    this._name = name
    this._description = description
    this._playerCount = playerCount
    this._maxPlayers = maxPlayers
    this._map = map
    this._playlist = playlist
    this._ip = ip
    this._port = port
    this._authPort = authPort
    this._password = password
    this._modInfo = modInfo
    this._lastHeartbeat = Date.now()
  }
  // #endregion

  // #region Readonly Properties
  public get id(): string {
    return this._id
  }

  public get name(): string {
    return this._id
  }

  public get description(): string {
    return this._description
  }

  public get playerCount(): number {
    return this._playerCount
  }

  public get maxPlayers(): number {
    return this._maxPlayers
  }

  public get map(): string {
    return this._map
  }

  public get playlist(): string {
    return this._playlist
  }

  public get ip(): string {
    return this._ip
  }

  public get port(): number {
    return this._port
  }

  public get authPort(): number {
    return this._authPort
  }

  public get password(): string {
    return this._password
  }

  public get hasPassword(): boolean {
    return this._password !== ''
  }

  public get modInfo(): Record<string, unknown> {
    return this._modInfo
  }

  public get lastHeartbeat(): number {
    return this._lastHeartbeat
  }
  // #endregion

  // #region Methods
  public clean(): CleanGameServer {
    const clean: CleanGameServer = Object.freeze({
      id: this._id,
      name: this._name,
      description: this._description,
      playerCount: this._playerCount,
      maxPlayers: this._maxPlayers,
      map: this._map,
      playlist: this._playlist,
      modInfo: this._modInfo,
      lastHeartbeat: this._lastHeartbeat,
    })

    return clean
  }
  // #endregion
}

const gameServers = new Map<string, GameServer>()
export const getGameServers = () => {
  return Object.fromEntries(gameServers.entries())
}

export const getGameServer = (id: string) => {
  return gameServers.get(id)
}

export const addGameServer = (server: GameServer) => {
  gameServers.set(server.id, server)
}

export const removeGameServer = (server: GameServer) => {
  gameServers.delete(server.id)
}
