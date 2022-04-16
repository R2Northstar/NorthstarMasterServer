const sqlite = require( "sqlite3" ).verbose()
const fs = require( "fs" )
const crypto = require( "crypto" )
const TOKEN_EXPIRATION_TIME = 3600000 * 24 // 24 hours

const DEFAULT_PDATA_BASELINE = fs.readFileSync( "default.pdata" )
const path = require( "path" )
const pjson = require( path.join( __dirname, "../shared/pjson.js" ) )
const DEFAULT_PDEF_OBJECT = pjson.ParseDefinition( fs.readFileSync( "persistent_player_data_version_231.pdef" ).toString() )

const dbSchemaRaw = fs.readFileSync( "./dbSchema.json" )
const dbSchema = JSON.parse( dbSchemaRaw )

let playerDB = new sqlite.Database( "playerdata.db", sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, async ex =>
{
	if ( ex )
		console.error( ex )
	else
		console.log( "Connected to player database successfully" )

	// create account table
	// this should mirror the PlayerAccount class's	properties
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS accounts (
		${ dbSchema.accounts.columns.map( ( col ) =>
	{
		return `${col.name} ${col.type} ${col.modifier ? col.modifier : ""}`
	} ).join( ",\n\r\t\t" ) }
		${ dbSchema.accounts.extra ? ","+dbSchema.accounts.extra : "" }
	)
	`, ex =>
	{
		if ( ex )
			console.error( ex )
		else
			console.log( "Created player account table successfully" )
	} )

	// create mod persistent data table
	// this should mirror the PlayerAccount class's	properties
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS modPersistentData (
		${ dbSchema.modPersistentData.columns.map( ( col ) =>
	{
		return `${col.name} ${col.type} ${col.modifier ? col.modifier : ""}`
	} ).join( ",\n\r\t\t" ) }
		${ dbSchema.modPersistentData.extra ? ","+dbSchema.modPersistentData.extra : "" }
	)
	`, ex =>
	{
		if ( ex )
			console.error( ex )
		else
			console.log( "Created mod persistent data table successfully" )
	} )

	for ( const col of dbSchema.accounts.columns )
	{
		if( !await columnExists( "accounts", col.name ) )
		{
			console.log( `The 'accounts' table is missing the '${col.name}' column` )
			await addColumnToTable( "accounts", col )
		}
	}
	for ( const col of dbSchema.modPersistentData.columns )
	{
		if( !await columnExists( "modPersistentData", col.name ) )
		{
			console.log( `The 'modPersistentData' table is missing the '${col.name}' column` )
			await addColumnToTable( "modPersistentData", col )
		}
	}
} )

function asyncDBGet( sql, params = [] )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.get( sql, params, ( ex, row ) =>
		{
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else
				resolve( row )
		} )
	} )
}

function asyncDBAll( sql, params = [] )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.all( sql, params, ( ex, row ) =>
		{
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else
				resolve( row )
		} )
	} )
}


function asyncDBRun( sql, params = [] )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.run( sql, params, ex =>
		{
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else
				resolve()
		} )
	} )
}

function columnExists( tableName, colName )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.get( `
        SELECT COUNT(*) AS CNTREC FROM pragma_table_info('${tableName}') WHERE name='${colName}'
        `, [], ( ex, row ) =>
		{
			if ( ex )
			{
				console.error( "Encountered error querying database: " + ex )
				reject( ex )
			}
			else
			{
				resolve( row.CNTREC == 1 )
			}
		} )
	} )
}

function addColumnToTable( tableName, column )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.run( `
        ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type} ${column.modifier ? column.modifier : ""}
        `, ex =>
		{
			if ( ex )
			{
				console.error( "Encountered error adding column to database: " + ex )
				reject( ex )
			}
			else
			{
				console.log( `Added '${column.name}' column to the '${tableName}' table` )
				resolve()
			}
		} )
	} )
}

class PlayerAccount
{
	// mirrors account struct in db

	// string id
	// string currentAuthToken
	// int currentAuthTokenExpirationTime
	// string currentServerId
	// Buffer persistentDataBaseline

	constructor ( id, currentAuthToken, currentAuthTokenExpirationTime, currentServerId, persistentDataBaseline, lastAuthIp, username )
	{
		this.id = id
		this.currentAuthToken = currentAuthToken
		this.currentAuthTokenExpirationTime = currentAuthTokenExpirationTime
		this.currentServerId = currentServerId
		this.persistentDataBaseline = persistentDataBaseline
		this.lastAuthIp = lastAuthIp
		this.username = username
	}
}

module.exports = {
	AsyncGetPlayerByID: async function AsyncGetPlayerByID( id )
	{
		let row = await asyncDBGet( "SELECT * FROM accounts WHERE id = ?", [ id ] )

		if ( !row )
			return null

		return new PlayerAccount( row.id, row.currentAuthToken, row.currentAuthTokenExpirationTime, row.currentServerId, row.persistentDataBaseline, row.lastAuthIp, row.username )
	},

	AsyncGetPlayersByUsername: async function AsyncGetPlayerByUsername( username )
	{
		let rows = await asyncDBAll( "SELECT * FROM accounts WHERE username = ?", [ username ] )

		return rows.map( row => new PlayerAccount( row.id, row.currentAuthToken, row.currentAuthTokenExpirationTime, row.currentServerId, row.persistentDataBaseline, row.lastAuthIp, row.username ) )
	},

	AsyncCreateAccountForID: async function AsyncCreateAccountForID( id )
	{
		await asyncDBRun( "INSERT INTO accounts ( id, persistentDataBaseline ) VALUES ( ?, ? )", [ id, DEFAULT_PDATA_BASELINE ] )
	},

	AsyncUpdateCurrentPlayerAuthToken: async function AsyncUpdateCurrentPlayerAuthToken( id, token )
	{
		await asyncDBRun( "UPDATE accounts SET currentAuthToken = ?, currentAuthTokenExpirationTime = ? WHERE id = ?", [ token, Date.now() + TOKEN_EXPIRATION_TIME, id ] )
	},

	AsyncUpdatePlayerUsername: async function AsyncUpdatePlayerUsername( id, username )
	{
		await asyncDBRun( "UPDATE accounts SET username = ? WHERE id = ?", [ username, id ] )
	},

	AsyncUpdatePlayerAuthIp: async function AsyncUpdatePlayerAuthIp( id, lastAuthIp )
	{
		await asyncDBRun( "UPDATE accounts SET lastAuthIp = ? WHERE id = ?", [ lastAuthIp, id ] )
	},

	AsyncUpdatePlayerCurrentServer: async function AsyncUpdatePlayerCurrentServer( id, serverId )
	{
		await asyncDBRun( "UPDATE accounts SET currentServerId = ? WHERE id = ?", [ serverId, id ] )
	},

	AsyncWritePlayerPersistenceBaseline: async function AsyncWritePlayerPersistenceBaseline( id, persistentDataBaseline )
	{
		await asyncDBRun( "UPDATE accounts SET persistentDataBaseline = ? WHERE id = ?", [ persistentDataBaseline, id ] )
	},

	AsyncGetPlayerModPersistence: async function AsyncGetPlayerModPersistence( id, pdiffHash )
	{
		// prevent JSON parse problems when the user has no data in the database
		let result = await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] )
		if ( result == undefined )
		{
			await asyncDBRun( "INSERT INTO modPersistentData ( id, pdiffHash, data ) VALUES ( ?, ?, ? )", [ id, pdiffHash, "{}" ] )
			result = await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] )
		}
		return JSON.parse( result.data )
	},

	// AsyncWritePlayerModPersistence: async function AsyncWritePlayerModPersistence( id, pdiffHash, data )
	// {

	// },

	// eslint-disable-next-line
	AsyncGetPlayerPersistenceBufferForMods: async function( id, pdiffs )
	{
		let player = await module.exports.AsyncGetPlayerByID( id )
		//return player.persistentDataBaseline

		// disabling this for now
		let pdefCopy = DEFAULT_PDEF_OBJECT
		let baselineJson = pjson.PdataToJson( player.persistentDataBaseline, DEFAULT_PDEF_OBJECT )

		let newPdataJson = baselineJson

		if ( !player )
			return null

		// temp etc
		for ( let pdiffstr of pdiffs )
		{
			let pdiff
			if ( pdiffstr )
			{
				try
				{
					let pdiffHash = crypto.createHash( "sha1" ).update( pdiffstr ).digest( "hex" )
					pdiff = pjson.ParseDefinitionDiff( pdiffstr )
					pdiff.hash = pdiffHash
				}
				catch ( ex )
				{
					console.log( ex )
				}
			}

			for ( let enumAdd in pdiff.enums )
			{
				pdefCopy.enums[ enumAdd ] = [ ...pdefCopy.enums[ enumAdd ], ...pdiff.enums[ enumAdd ] ]
			}
			pdefCopy = objCombine( pdefCopy, pdiff.pdef )
			// this assign call won't work, but basically what it SHOULD do is replace any pdata keys that are in the mod pdata and append new ones to the end
			// i added an await, maybe that fixed it? - Spoon
			// the issue was that assign doesnt recurse at all, we have to call for each thing inside it
			let result = await module.exports.AsyncGetPlayerModPersistence( id, pdiff.hash )
			newPdataJson = objCombine( newPdataJson, result )
		}
		let ret
		try
		{
			ret = pjson.PdataJsonToBuffer( newPdataJson, pdefCopy )
		}
		catch ( ex )
		{
			console.log( ex )
		}
		return ret

		function objCombine( obj1, obj2 )
		{
			let combined = {}

			for ( let key of Object.keys( obj1 ) )
			{
				if ( !combined[key] )
				{
					combined[key] = []
				}
				for ( let innerKey of Object.keys( obj1[key] ) )
				{
					combined[key][innerKey] = obj1[key][innerKey]
				}
			}

			for ( let key of Object.keys( obj2 ) )
			{
				if ( !combined[key] )
				{
					combined[key] = []
				}
				for ( let innerKey of Object.keys( obj2[key] ) )
				{
					combined[key][innerKey] = obj2[key][innerKey]
				}
			}
			return combined

		}
	}
}
