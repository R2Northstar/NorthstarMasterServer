import path from 'node:path'
import fs from 'node:fs'

const sqlite = require( "sqlite3" ).verbose()
const pjson = require( "../shared/pjson.js" )
const TOKEN_EXPIRATION_TIME = 3600000 * 24 // 24 hours

const DEFAULT_PDATA_BASELINE = fs.readFileSync( path.join( __dirname, "..", "..", "assets", "default.pdata" ) )
const DEFAULT_PDEF_OBJECT = pjson.ParseDefinition( fs.readFileSync( path.join( __dirname, "..", "..", "assets", "persistent_player_data_version_231.pdef" ) ).toString() )

let playerDB = new sqlite.Database( 'playerdata.db', sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, ex => {
	if ( ex ) console.error( ex )
	else console.log( "Connected to player database successfully" )

	// create account table
	// this should mirror the PlayerAccount class's	properties
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY NOT NULL,
		currentAuthToken TEXT,
		currentAuthTokenExpirationTime INTEGER,
		currentServerId TEXT,
		persistentDataBaseline BLOB NOT NULL
	)
	`, ex => {
		if ( ex )
			console.error( ex )
		else
			console.log( "Created player account table successfully" )
	})

	// create mod persistent data table
	// this should mirror the PlayerAccount class's	properties
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS modPeristentData (
		id TEXT NOT NULL,
		pdiffHash TEXT NOT NULL,
		data TEXT NOT NULL,
		PRIMARY KEY ( id, pdiffHash )
	)
	`, ex => {
		if ( ex )
			console.error( ex )
		else
			console.log( "Created mod persistent data table successfully" )
	})
})

function asyncDBGet( sql, params = [] )
{
	return new Promise( ( resolve, reject ) => {
		playerDB.get( sql, params, ( ex, row ) => {
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else
				resolve( row )
		})
	})
}

function asyncDBRun( sql, params = [] )
{
	return new Promise( ( resolve, reject ) => {
		playerDB.run( sql, params, ex => {
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else
				resolve()
		})
	})
}

class PlayerAccount {
	public id: string
	public currentAuthToken: string
	public currentAuthTokenExpirationTime: number
	public currentServerId: string
	public persistentDataBaseline: Buffer

	constructor (id: string, currentAuthToken: string, currentAuthTokenExpirationTime: number, currentServerId: string, persistentDataBaseline: Buffer) {
		this.id = id
		this.currentAuthToken = currentAuthToken
		this.currentAuthTokenExpirationTime = currentAuthTokenExpirationTime
		this.currentServerId = currentServerId
		this.persistentDataBaseline = persistentDataBaseline
	}
}

export const AsyncGetPlayerByID = async (id: string) => {
	let row = await asyncDBGet( "SELECT * FROM accounts WHERE id = ?", [ id ] )
	if (!row) return null

	return new PlayerAccount(row.id, row.currentAuthToken, row.currentAuthTokenExpirationTime, row.currentServerId, row.persistentDataBaseline)
}

export const AsyncCreateAccountForID = async (id: string) => {
	await asyncDBRun( "INSERT INTO accounts ( id, persistentDataBaseline ) VALUES ( ?, ? )", [ id, DEFAULT_PDATA_BASELINE ] )
}

export const AsyncUpdateCurrentPlayerAuthToken = async (id: string, token: string) => {
	await asyncDBRun( "UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ? WHERE id = ?", [ token, Date.now() + TOKEN_EXPIRATION_TIME, id ] )
}

export const AsyncUpdatePlayerCurrentServer = async (id: string, serverId: string) => {
	await asyncDBRun( "UPDATE accounts SET currentServerId = ? WHERE id = ?", [ serverId, id ] )
}

export const AsyncWritePlayerPersistenceBaseline = async (id: string, persistentDataBaseline) => {
	await asyncDBRun( "UPDATE accounts SET persistentDataBaseline = ? WHERE id = ?", [ persistentDataBaseline, id ] )
}

export const AsyncGetPlayerModPersistence = async (id: string, pdiffHash) => {
	return JSON.parse( await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] ) )
}

export const AsyncWritePlayerModPersistence = async (id, pdiffHash, data) => {
	// TODO
}

export const AsyncGetPlayerPersistenceBufferForMods = async (id: string, pdiffs) => {
	let player = await AsyncGetPlayerByID( id )
	return player?.persistentDataBaseline

	// disabling this for now
	/*let pdefCopy = DEFAULT_PDEF_OBJECT
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

	return PdataJsonToBuffer( newPdataJson, pdefCopy )*/
}
