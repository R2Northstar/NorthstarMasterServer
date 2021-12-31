import { type Decoder, type Encoder } from '@msgpack/msgpack'
import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { type OnlyProperties } from '~utils.js'

type HiddenFields = 'serverAuthToken' | 'ip' | 'port' | 'authPort' | 'password'
export type CleanGameServer = Readonly<
  Omit<OnlyProperties<GameServer>, HiddenFields>
>

export interface Mod {
  Name: string
  Version: string
  RequiredOnClient: boolean
  Pdiff: string | null
}

export interface ModInfo {
  Mods: Mod[]
}

export interface GameServerOptions {
  id?: string
  serverAuthToken?: string
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
  lastHeartbeat?: Date
}

export class GameServer {
  public static decode(buffer: Buffer, decoder: Decoder): GameServer {
    const raw = decoder.decode(buffer)
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('invalid serialized GameServer')
    }

    const checkValid: (r: Record<string, unknown>) => boolean = r => {
      // Check fields exist
      if ('id' in r === false) return false
      if ('authToken' in r === false) return false
      if ('name' in r === false) return false
      if ('description' in r === false) return false
      if ('playerCount' in r === false) return false
      if ('maxPlayers' in r === false) return false
      if ('map' in r === false) return false
      if ('playlist' in r === false) return false
      if ('ip' in r === false) return false
      if ('port' in r === false) return false
      if ('authPort' in r === false) return false
      if ('password' in r === false) return false
      if ('modInfo' in r === false) return false
      if ('lastHeartbeat' in r === false) return false

      return true
    }

    if (checkValid(raw as Record<string, unknown>) === false) {
      throw new Error('invalid serialized GameServer')
    }

    const options = raw as GameServerOptions
    return new GameServer(options)
  }

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
    this.id = options.id ?? randomBytes(16).toString('hex')
    this.serverAuthToken = options.serverAuthToken ?? randomBytes(16).toString('hex')
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
    this.modInfo = options.modInfo ?? { Mods: [] }
    this.lastHeartbeat = Date.now()
  }
  // #endregion

  // #region Methods
  public encode(encoder: Encoder): Buffer {
    const encoded = encoder.encode(this)
    const buffer = Buffer.from(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength
    )

    return buffer
  }

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
