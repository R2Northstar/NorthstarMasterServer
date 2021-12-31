import { type Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { DEFAULT_PDATA_BASELINE, TOKEN_EXPIRATION_TIME } from '../constants.js'
import { db } from '../db.js'
import { type OnlyProperties } from '../utils.js'

// #region Account Class
interface AccountOptions {
  id: string
  authToken?: string
  authTokenExpireTime?: number
  currentServerID?: string
  persistentDataBaseline?: Buffer
}

class PlayerAccount {
  public readonly id: string
  private _authToken: string
  private _authTokenExpireTime: number
  private _currentServerID: string | undefined
  private _persistentDataBaseline: Buffer

  constructor(options: AccountOptions) {
    this.id = options.id
    this._authToken = options.authToken ?? randomBytes(16).toString('hex')
    this._authTokenExpireTime =
      options.authTokenExpireTime ?? Date.now() + TOKEN_EXPIRATION_TIME
    this._persistentDataBaseline =
      options.persistentDataBaseline ?? DEFAULT_PDATA_BASELINE
  }

  // #region Readonly Fields
  public get authToken(): string {
    return this._authToken
  }

  public get authTokenExpireTime(): number {
    return this._authTokenExpireTime
  }

  public get currentServerID(): string | undefined {
    return this._currentServerID
  }

  public get persistentDataBaseline(): Buffer {
    return this._persistentDataBaseline
  }
  // #endregion

  public tokenExpired(): boolean {
    return this._authTokenExpireTime < Date.now()
  }

  // #region Update Methods
  public async updateAuthToken(token?: string) {
    const authToken = token ?? randomBytes(16).toString('hex')
    const authTokenExpireTime = Date.now() + TOKEN_EXPIRATION_TIME

    await db<AccountProperties>('accounts')
      .update({ authToken, authTokenExpireTime })
      .where({ id: this.id })

    this._authToken = authToken
    this._authTokenExpireTime = authTokenExpireTime
  }

  public async updateCurrentServer(serverID: string) {
    await db<AccountProperties>('accounts')
      .update({ currentServerID: serverID })
      .where({ id: this.id })

    this._currentServerID = serverID
  }

  public async updatePersistentDataBaseline(persistentDataBaseline: Buffer) {
    await db<AccountProperties>('accounts')
      .update({ persistentDataBaseline })
      .where({ id: this.id })

    this._persistentDataBaseline = persistentDataBaseline
  }
  // #endregion
}
// #endregion

// #region Methods
type AccountProperties = OnlyProperties<PlayerAccount>
const accountToModel: (
  account: PlayerAccount
) => AccountProperties = account => ({
  id: account.id,
  authToken: account.authToken,
  authTokenExpireTime: account.authTokenExpireTime,
  currentServerID: account.currentServerID,
  persistentDataBaseline: account.persistentDataBaseline,
})

export const createAccount: (
  id: string
) => Promise<PlayerAccount> = async id => {
  const account = new PlayerAccount({ id })
  const model = accountToModel(account)

  await db<AccountProperties>('accounts').insert(model)
  return account
}

export const getById: (
  id: string
) => Promise<PlayerAccount | undefined> = async id => {
  const result = await db<AccountProperties>('accounts')
    .select('*')
    .where({ id })
    .limit(1)
    .first()

  if (result === undefined) return undefined
  return new PlayerAccount(result)
}

export const getOrCreate: (id: string) => Promise<PlayerAccount> = async id => {
  const account = await getById(id)
  if (account !== undefined) return account

  const newAccount = await createAccount(id)
  return newAccount
}
// #endregion
