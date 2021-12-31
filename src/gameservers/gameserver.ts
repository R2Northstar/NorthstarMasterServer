import { randomBytes } from 'node:crypto'
import { type OnlyProperties } from '../utils.js'

type HiddenFields = 'serverAuthToken' | 'ip' | 'port' | 'authPort' | 'password'
export type CleanGameServer = Readonly<
  Omit<OnlyProperties<GameServer>, HiddenFields>
>

type ModInfo = Record<string, unknown>
export interface GameServerOptions {
  name: string
  description: string
  playerCount: number
  maxPlayers: number
  map: string
  playlist: string
  ip: string
  port: number
  authPort: number
  password?: string
  modInfo?: ModInfo
}

export class GameServer {
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
  public modInfo: ModInfo
  public lastHeartbeat: number

  // #endregion

  // #region Constructor
  constructor(options: GameServerOptions) {
    this.id = randomBytes(16).toString('hex')
    this.serverAuthToken = randomBytes(16).toString('hex')
    this.name = options.name
    this.description = options.description
    this.playerCount = options.playerCount
    this.maxPlayers = options.maxPlayers
    this.map = options.map
    this.playlist = options.playlist
    this.ip = options.ip
    this.port = options.port
    this.authPort = options.authPort
    this.password = options.password ?? ''
    this.hasPassword = Boolean(this.password)
    this.modInfo = options.modInfo ?? {}
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
      lastHeartbeat: this.lastHeartbeat,
    })

    return clean
  }
  // #endregion
}
