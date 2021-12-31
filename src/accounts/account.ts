import { type Buffer } from 'node:buffer'

// #region Account Class
interface AccountOptions {
  id: string
  authToken: string
  authTokenExpireTime: number
  currentServerID: string
  persistentDataBaseline: Buffer
}

class PlayerAccount {
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
// #endregion

// #region Methods
export const createAccount: (
  id: string
) => Promise<PlayerAccount> = async id => {
  throw new Error('not implemented')
}

export const getById: (
  id: string
) => Promise<PlayerAccount | undefined> = async id => {
  throw new Error('not implemented')
}

export const getOrCreate: (id: string) => Promise<PlayerAccount> = async id => {
  const account = await getById(id)
  if (account !== undefined) return account

  const newAccount = await createAccount(id)
  return newAccount
}
// #endregion
