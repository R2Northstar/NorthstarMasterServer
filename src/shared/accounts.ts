import { Buffer } from 'node:buffer'
import sqliteRaw from 'sqlite3'
import { DEFAULT_PDATA_BASELINE, TOKEN_EXPIRATION_TIME } from '../constants.js'

const sqlite = sqliteRaw.verbose()
const playerDB = new sqlite.Database(
  'playerdata.db',
  sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE,
  ex => {
    if (ex) console.error(ex)
    else console.log('Connected to player database successfully')

    // Create account table
    // this should mirror the PlayerAccount class's	properties
    playerDB.run(
      `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY NOT NULL,
		currentAuthToken TEXT,
		currentAuthTokenExpirationTime INTEGER,
		currentServerId TEXT,
		persistentDataBaseline BLOB NOT NULL
	)
	`,
      ex => {
        if (ex) console.error(ex)
        else console.log('Created player account table successfully')
      }
    )

    // Create mod persistent data table
    // this should mirror the PlayerAccount class's	properties
    playerDB.run(
      `
	CREATE TABLE IF NOT EXISTS modPeristentData (
		id TEXT NOT NULL,
		pdiffHash TEXT NOT NULL,
		data TEXT NOT NULL,
		PRIMARY KEY ( id, pdiffHash )
	)
	`,
      ex => {
        if (ex) console.error(ex)
        else console.log('Created mod persistent data table successfully')
      }
    )
  }
)

async function asyncDBGet(sql: string, parameters: any[] = []) {
  return new Promise((resolve, reject) => {
    playerDB.get(sql, parameters, (ex, row) => {
      if (ex) {
        console.log('Encountered error querying player database')
        console.error(ex)

        reject(ex)
      } else resolve(row)
    })
  })
}

async function asyncDBRun(sql: string, parameters: any[] = []) {
  return new Promise<void>((resolve, reject) => {
    playerDB.run(sql, parameters, ex => {
      if (ex) {
        console.log('Encountered error querying player database')
        console.error(ex)

        reject(ex)
      } else resolve()
    })
  })
}

class PlayerAccount {
  public id: string
  public currentAuthToken: string
  public currentAuthTokenExpirationTime: number
  public currentServerId: string
  public persistentDataBaseline: Buffer

  constructor(
    id: string,
    currentAuthToken: string,
    currentAuthTokenExpirationTime: number,
    currentServerId: string,
    persistentDataBaseline: Buffer
  ) {
    this.id = id
    this.currentAuthToken = currentAuthToken
    this.currentAuthTokenExpirationTime = currentAuthTokenExpirationTime
    this.currentServerId = currentServerId
    this.persistentDataBaseline = persistentDataBaseline
  }
}

export const asyncGetPlayerByID = async (id: string) => {
  const row = await asyncDBGet('SELECT * FROM accounts WHERE id = ?', [id])
  if (!row) return null

  return new PlayerAccount(
    row.id,
    row.currentAuthToken,
    row.currentAuthTokenExpirationTime,
    row.currentServerId,
    row.persistentDataBaseline
  )
}

export const asyncCreateAccountForID = async (id: string) => {
  await asyncDBRun(
    'INSERT INTO accounts ( id, persistentDataBaseline ) VALUES ( ?, ? )',
    [id, DEFAULT_PDATA_BASELINE]
  )
}

export const asyncUpdateCurrentPlayerAuthToken = async (
  id: string,
  token: string
) => {
  await asyncDBRun(
    'UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ? WHERE id = ?',
    [token, Date.now() + TOKEN_EXPIRATION_TIME, id]
  )
}

export const asyncUpdatePlayerCurrentServer = async (
  id: string,
  serverId: string
) => {
  await asyncDBRun('UPDATE accounts SET currentServerId = ? WHERE id = ?', [
    serverId,
    id,
  ])
}

export const asyncWritePlayerPersistenceBaseline = async (
  id: string,
  persistentDataBaseline
) => {
  await asyncDBRun(
    'UPDATE accounts SET persistentDataBaseline = ? WHERE id = ?',
    [persistentDataBaseline, id]
  )
}

export const asyncGetPlayerModPersistence = async (id: string, pdiffHash) => {
  return JSON.parse(
    await asyncDBGet(
      'SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?',
      [id, pdiffHash]
    )
  )
}

export const asyncWritePlayerModPersistence = async (id, pdiffHash, data) => {
  // TODO
}

export const asyncGetPlayerPersistenceBufferForMods = async (
  id: string,
  pdiffs
) => {
  const player = await asyncGetPlayerByID(id)
  return player?.persistentDataBaseline

  // Disabling this for now
  /* let pdefCopy = DEFAULT_PDEF_OBJECT
	let baselineJson = pjson.PdataToJson( player.persistentDataBaseline, DEFAULT_PDEF_OBJECT )

	let newPdataJson = baselineJson

	if ( !player )
		return null

	// temp etc
	/*for ( let pdiff of pdiffs )
	{
		for ( let enumAdd in pdiff.enums )
			pdefCopy.enums[ enumAdd ] = [ ...pdefCopy.enums[ enumAdd ], ...pdiff.enums[ enumAdd ] ]

		pdefCopy = Object.assign( pdefCopy, pdiff.pdef )
		// this assign call won't work, but basically what it SHOULD do is replace any pdata keys that are in the mod pdata and append new ones to the end
		newPdataJson = Object.assign( newPdataJson, this.AsyncGetPlayerModPersistence( id, pdiff.hash ) )
	}

	return PdataJsonToBuffer( newPdataJson, pdefCopy ) */
}
