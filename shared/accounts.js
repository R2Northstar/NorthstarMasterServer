const sqlite = require( "sqlite3" ).verbose()
const path = require( "path" )
const fs = require( "fs" )
const pjson = require( path.join( __dirname, "../shared/pjson.js" ) ) 
const TOKEN_EXPIRATION_TIME = 3600000 * 24 // 24 hours

const DEFAULT_PDATA_BASELINE = fs.readFileSync( "default.pdata" )
const DEFAULT_PDEF_OBJECT = pjson.ParseDefinition( fs.readFileSync( "persistent_player_data_version_231.pdef" ).toString() )

let playerDB = new sqlite.Database( 'playerdata.db', sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, ex => { 
	if ( ex )
		console.error( ex )
	else
		console.log( "Connected to player database successfully" )
	
	// create account table
	// this should mirror the PlayerAccount class's	properties
	// Added isBanned to databse
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY NOT NULL,
		currentAuthToken TEXT,
		currentAuthTokenExpirationTime INTEGER,
		currentServerId TEXT, 
		persistentDataBaseline BLOB NOT NULL,
		playerName TEXT,
		isBanned INTEGER DEFAULT 0
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

class PlayerAccount
{
	// mirrors account struct in db

	// string id
	// string currentAuthToken
	// int currentAuthTokenExpirationTime
	// string currentServerId
	// Buffer persistentDataBaseline
	
	constructor ( id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, playerName, isBanned )
	{
		this.id = id
		this.currentAuthToken = currentAuthToken
		this.currentAuthTokenExpirationTime = currentAuthTokenExpirationTime
		this.currentServerId = currentServerId
		this.persistentDataBaseline = persistentDataBaseline
		this.playerName = playerName
		this.isBanned = isBanned
	}
}

module.exports = {
	AsyncGetPlayerByID: async function AsyncGetPlayerByID( id ) {
		let row = await asyncDBGet( "SELECT * FROM accounts WHERE id = ?", [ id ] )
		
		if ( !row )
			return null
		
		return new PlayerAccount( row.id, row.currentAuthToken, row.currentAuthTokenExpirationTime, row.currentServerId, row.persistentDataBaseline, row.playerName, row.isBanned )
	},
	
	AsyncCreateAccountForID: async function AsyncCreateAccountForID( id , playerName ) {
		await asyncDBRun( "INSERT INTO accounts ( id, persistentDataBaseline, playerName ) VALUES ( ?, ? ,? )", [ id, DEFAULT_PDATA_BASELINE, playerName ] )
	},
	
	AsyncUpdatePlayerNameForID: async function AsyncCreateAccountForID( id , playerName ) {
		await asyncDBRun( "UPDATE accounts SET playerName = ?, WHERE id = ?", [playerName,id] )
	},
	
	

	AsyncBanAccountByID: async function AsyncBanAccountByID( id ) {
		await asyncDBRun( "UPDATE accounts SET isBanned = 1, WHERE id = ?", [id] )
	},
	AsyncUnbanAccountByID: async function AsyncUnbanAccountByID( id ) {
		await asyncDBRun( "UPDATE accounts SET isBanned = 0, WHERE id = ?", [id] )
	},
	
	
	
	AsyncUpdateCurrentPlayerAuthToken: async function AsyncUpdateCurrentPlayerAuthToken( id, token ) {
		await asyncDBRun( "UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ? WHERE id = ?", [ token, Date.now() + TOKEN_EXPIRATION_TIME, id ] )
	},

	AsyncUpdatePlayerCurrentServer: async function AsyncUpdatePlayerCurrentServer( id, serverId ) {
		await asyncDBRun( "UPDATE accounts SET currentServerId = ? WHERE id = ?", [ serverId, id ] )
	},
	
	AsyncWritePlayerPersistenceBaseline: async function AsyncWritePlayerPersistenceBaseline( id, persistentDataBaseline ) {
		await asyncDBRun( "UPDATE accounts SET persistentDataBaseline = ? WHERE id = ?", [ persistentDataBaseline, id ] )
	},

	AsyncGetPlayerModPersistence: async function AsyncGetPlayerModPersistence( id, pdiffHash ) {
		return JSON.parse( await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] ) )
	},

	AsyncWritePlayerModPersistence: async function AsyncWritePlayerModPersistence( id, pdiffHash, data ) {
		
	},

	AsyncGetPlayerPersistenceBufferForMods: async function( id, pdiffs ) {
		let player = await module.exports.AsyncGetPlayerByID( id )
		return player.persistentDataBaseline

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
}
