import { type Buffer } from 'node:buffer'

interface AccountOptions {
  id: string
  authToken: string
  authTokenExpireTime: number
  currentServerID: string
  persistentDataBaseline: Buffer
}

export class PlayerAccount {
  public readonly id: string
  private readonly _authToken: string
  private readonly _authTokenExpireTime: number
  private readonly _currentServerID: string
  private readonly _persistentDataBaseline: Buffer

  constructor(options: AccountOptions) {
    this.id = options.id
    this._authToken = options.authToken
    this._authTokenExpireTime = options.authTokenExpireTime
    this._currentServerID = options.currentServerID
    this._persistentDataBaseline = options.persistentDataBaseline
  }

  // #region Readonly Fields
  public get authToken(): string {
    return this._authToken
  }

  public get authTokenExpireTime(): number {
    return this._authTokenExpireTime
  }

  public get currentServerID(): string {
    return this._currentServerID
  }

  public get persistentDataBaseline(): Buffer {
    return this._persistentDataBaseline
  }
  // #endregion

  // #region Update Methods
  public async updateAuthToken(token: string) {
    // TODO
    throw new Error('not implemented')
  }

  public async updateCurrentServer(serverID: string) {
    // TODO
    throw new Error('not implemented')
  }

  public async updatePersistentDataBaseline(persistentDataBaseline: Buffer) {
    // TODO
    throw new Error('not implemented')
  }
  // #endregion
}
