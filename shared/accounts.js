const sqlite = require( "sqlite3" ).verbose()
const path = require( "path" )
const fs = require( "fs" )
const pjson = require( path.join( __dirname, "../shared/pjson.js" ) ) 
const TOKEN_EXPIRATION_TIME = 3600000 * 24 // 24 hours

const { logger, logMonarch } = require("../logging.js") 

const DEFAULT_PDATA_BASELINE = fs.readFileSync( "default.pdata" )
const DEFAULT_PDEF_OBJECT = pjson.ParseDefinition( fs.readFileSync( "persistent_player_data_version_231.pdef" ).toString() )

let playerDBOpen = false;
let playerDB;
function openDB() {
	playerDB = new sqlite.Database( process.env.DB_PATH || 'playerdata.db', sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, ex => { 
		if ( ex )
			logger.error( ex )
		else
			logMonarch( "Connected to player database successfully" )
		
		playerDBOpen = true;

		// create account table
		// this should mirror the PlayerAccount class's	properties
		playerDB.run( `
		CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY NOT NULL,
			currentAuthToken TEXT,
			currentAuthTokenExpirationTime INTEGER,
			currentServerId TEXT,
			persistentDataBaseline BLOB NOT NULL,
			lastModified INTEGER DEFAULT 0,
      lastAuthIp TEXT
		)
		`, ex => {
			if ( ex )
				logger.error( ex )
			else
				logMonarch( "Created player account table successfully" )
		})

		// create mod persistent data table
		// this should mirror the PlayerAccount class's	properties
		playerDB.run( `
		CREATE TABLE IF NOT EXISTS modPersistentData (
			id TEXT NOT NULL,
			pdiffHash TEXT NOT NULL,
			data TEXT NOT NULL,
			lastModified INTEGER DEFAULT 0,
			PRIMARY KEY ( id, pdiffHash )
		)
		`, ex => {
			if ( ex )
				logger.error( ex )
			else
				logMonarch( "Created mod persistent data table successfully" )
		})
	})
}
openDB()

function asyncDBGet( sql, params = [] )
{
	return new Promise( async ( resolve, reject ) => {
		await playerDBIsOpen();
		playerDB.get( sql, params, ( ex, row ) => {
			if ( ex )
			{
				logger.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else 
				resolve( row )
		})
	})
}
function asyncDBAll( sql, params = [] )
{
	return new Promise( async ( resolve, reject ) => {
		await playerDBIsOpen();
		playerDB.all( sql, params, ( ex, rows ) => {
			if ( ex )
			{
				logger.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else 
				resolve( rows )
		})
	})
}

function asyncDBRun( sql, params = [] )
{
	return new Promise( async ( resolve, reject ) => {
		await playerDBIsOpen();
		playerDB.run( sql, params, ex => {
			if ( ex )
			{
				logger.error( "Encountered error querying player database: " + ex )
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
	
	constructor ( id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, lastAuthIp, lastModified )
	{
		this.id = id
		this.currentAuthToken = currentAuthToken
		this.currentAuthTokenExpirationTime = currentAuthTokenExpirationTime
		this.currentServerId = currentServerId
		this.persistentDataBaseline = persistentDataBaseline
		this.lastModified = lastModified
		this.lastAuthIp = lastAuthIp
	}
}

async function AsyncGetPlayerByID( id ) {
	let row = await asyncDBGet( "SELECT * FROM accounts WHERE id = ?", [ id ] )
	
	if ( !row )
		return null
	
	return new PlayerAccount( row.id, row.currentAuthToken, row.currentAuthTokenExpirationTime, row.currentServerId, row.persistentDataBaseline, row.lastAuthIp, row.lastModified )
}

module.exports = {
	AsyncGetPlayerByID,

	AsyncGetAllPlayers: async function AsyncGetAllPlayers() {
		let rows = await asyncDBAll( "SELECT * FROM accounts" )
		if ( !rows )
			return null
		
		return rows
	},
	
	AsyncCreateAccountForID: async function AsyncCreateAccountForID( id, timestamp = Date.now() ) {
		await asyncDBRun( "INSERT INTO accounts ( id, persistentDataBaseline, lastModified ) VALUES ( ?, ?, ? )", [ id, DEFAULT_PDATA_BASELINE, timestamp ] )
	},

	AsyncCreateAccountFromData: async function AsyncCreateAccountFromData( data, timestamp = Date.now() ) {
		let { id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline } = data;
		await asyncDBRun( "INSERT INTO accounts ( id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, lastModified ) VALUES ( ?, ?, ?, ?, ?, ? )", [ id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, timestamp ] )
	},

	AsyncUpdatePlayer: async function AsyncUpdatePlayer( id, data, timestamp = Date.now() ) {
		let { currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline } = Object.assign({}, data, await AsyncGetPlayerByID( id ))
		await asyncDBRun( "UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ?, currentServerId = ?, persistentDataBaseline = ?, lastModified = ? WHERE id = ?", [ currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, timestamp, id ] )
	},

	AsyncUpdateCurrentPlayerAuthToken: async function AsyncUpdateCurrentPlayerAuthToken( id, token, timestamp = Date.now() ) {
		await asyncDBRun( "UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ?, lastModified = ? WHERE id = ?", [ token, timestamp + TOKEN_EXPIRATION_TIME, timestamp, id ] )
	},
	AsyncUpdatePlayerAuthIp: async function AsyncUpdatePlayerAuthIp( id, lastAuthIp, timestamp = Date.now() ) {
		await asyncDBRun( "UPDATE accounts SET lastAuthIp = ?, lastModified = ? WHERE id = ?", [ lastAuthIp, timestamp, id ] )
	},

	AsyncUpdatePlayerCurrentServer: async function AsyncUpdatePlayerCurrentServer( id, serverId, timestamp = Date.now() ) {
		await asyncDBRun( "UPDATE accounts SET currentServerId = ?, lastModified = ? WHERE id = ?", [ serverId, timestamp, id ] )
	},
	
	AsyncWritePlayerPersistenceBaseline: async function AsyncWritePlayerPersistenceBaseline( id, persistentDataBaseline, timestamp = Date.now() ) {
		await asyncDBRun( "UPDATE accounts SET persistentDataBaseline = ?, lastModified = ? WHERE id = ?", [ persistentDataBaseline, timestamp, id ] )
	},

	AsyncGetPlayerModPersistence: async function AsyncGetPlayerModPersistence( id, pdiffHash ) {
		return JSON.parse( await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] ) )
	},

	AsyncWritePlayerModPersistence: async function AsyncWritePlayerModPersistence( id, pdiffHash, data ) {
		
	},

	AsyncGetPlayerPersistenceBufferForMods: async function( id, pdiffs ) {
		let player = await AsyncGetPlayerByID( id )
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
	},

	BackupDatabase: async function BackupDatabase() { // closes db, copies it, then opens db. hopefully doesn't break anything
		logMonarch("Backing up database")
		playerDBOpen = false;
		await playerDB.close()
		var dir = './backups';
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.copyFileSync(process.env.DB_PATH || 'playerdata.db', dir+'/'+(process.env.DB_PATH || 'playerdata.db')+'_'+new Date().toISOString().replace(/:/g, "-")+'.bak')
		openDB()
	}
}

function playerDBIsOpen() {
    return new Promise(function (resolve, reject) {
        (function waitForPlayerDBOpen(){
            if (playerDBOpen) return resolve();
            setTimeout(waitForPlayerDBOpen, 30);
        })();
    });
}