const sqlite = require( "sqlite3" ).verbose()
const fs = require( "fs" )
const TOKEN_EXPIRATION_TIME = 3600000 * 24 // 24 hours

const bcrypt = require( "bcrypt" )
const BCRYPT_SALT_ROUNDS = 10

const DEFAULT_PDATA_BASELINE = fs.readFileSync( "default.pdata" )
// const pjson = require( "../shared/pjson" )
// const DEFAULT_PDEF_OBJECT = pjson.ParseDefinition( fs.readFileSync( "persistent_player_data_version_231.pdef" ).toString() )

const dbSchemaRaw = fs.readFileSync( "./dbSchema.json" )
const dbSchema = JSON.parse( dbSchemaRaw )

if( fs.existsSync( "playerdata.db" ) ) // migrate to agnostic db file
{
	fs.renameSync( "playerdata.db", "northstar.db" )
}

let playerDB = new sqlite.Database( "northstar.db", sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, async ex =>
{
	if ( ex )
		console.error( ex )
	else
		console.log( "Connected to player database successfully" )

	for( const [tableName, table] of Object.entries( dbSchema ) )
	{
		playerDB.run( `
            CREATE TABLE IF NOT EXISTS ${tableName} (
                ${ table.columns.map( ( col ) => `${col.name} ${col.type} ${col.modifier ? col.modifier : ""}` ).join( ", " ) }
                ${ table.extra ? ","+table.extra : "" }
            )
            `, ex =>
		{
			if ( ex )
				console.error( ex )
			else
				console.log( `Created player ${tableName} table successfully` )
		} )

		for ( const col of table.columns )
		{
			if( !await columnExists( tableName, col.name ) )
			{
				console.log( `The '${tableName}' table is missing the '${col.name}' column` )
				await addColumnToTable( tableName, col )
			}
		}
		if( table.indices )
		{
			for ( const idx of table.indices )
			{
				if( !await indexExists( idx.name ) )
				{
					console.log( `The '${tableName}' table is missing the '${idx.name}' index` )
					await addIndexToTable( tableName, idx )
				}
			}
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

function indexExists( idxName )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.get( `
        SELECT COUNT(*) AS CNTREC FROM sqlite_master WHERE type='index' AND name='${idxName}'
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

function addIndexToTable( tableName, index )
{
	return new Promise( ( resolve, reject ) =>
	{
		playerDB.run( `
        CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${index.name} ON ${tableName}(${index.columns.join( ", " )})
        `, ex =>
		{
			if ( ex )
			{
				console.error( "Encountered error adding index to database: " + ex )
				reject( ex )
			}
			else
			{
				console.log( `Added '${index.name}' index to the '${tableName}' table` )
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

	AsyncGetIDsByUsername: async function AsyncGetIDsByUsername( username )
	{
		let rows = await asyncDBAll( "SELECT id FROM accounts WHERE username = ?", [ username ] )

		return rows
	},
	AsyncGetUsernameByID: async function AsyncGetUsernameByID( id )
	{
		let row = await asyncDBGet( "SELECT username FROM accounts WHERE id = ?", [ id ] )

		if ( !row )
			return null

		return row
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
		return JSON.parse( await asyncDBGet( "SELECT data from modPersistentData WHERE id = ? AND pdiffHash = ?", [ id, pdiffHash ] ) )
	},

	// AsyncWritePlayerModPersistence: async function AsyncWritePlayerModPersistence( id, pdiffHash, data )
	// {

	// },

	// eslint-disable-next-line
	AsyncGetPlayerPersistenceBufferForMods: async function( id, pdiffs )
	{
		let player = await module.exports.AsyncGetPlayerByID( id )
		return player.persistentDataBaseline

		//	// disabling this for now
		//	let pdefCopy = DEFAULT_PDEF_OBJECT
		//	let baselineJson = pjson.PdataToJson( player.persistentDataBaseline, DEFAULT_PDEF_OBJECT )

		//	let newPdataJson = baselineJson

		//	if ( !player )
		//		return null

		//	// temp etc
		//	for ( let pdiff of pdiffs )
		//	{
		//		for ( let enumAdd in pdiff.enums )
		//			pdefCopy.enums[ enumAdd ] = [ ...pdefCopy.enums[ enumAdd ], ...pdiff.enums[ enumAdd ] ]

		//		pdefCopy = Object.assign( pdefCopy, pdiff.pdef )
		//		// this assign call won't work, but basically what it SHOULD do is replace any pdata keys that are in the mod pdata and append new ones to the end
		//		newPdataJson = Object.assign( newPdataJson, this.AsyncGetPlayerModPersistence( id, pdiff.hash ) )
		//	}

		//	return PdataJsonToBuffer( newPdataJson, pdefCopy )
	},

	AsyncHasPlayerUsedGameToken: async function( id, token )
	{
		let hashedToken = await bcrypt.hash( token, BCRYPT_SALT_ROUNDS )

		let row = await asyncDBGet( "SELECT usedGameTokens FROM accounts WHERE id = ?", [ id ] )

		return ( row.usedGameTokens.split( "," ).indexOf( hashedToken ) >= 0 )
	},

	AsyncAddPlayerUsedGameToken: async function( id, token )
	{
		let hashedToken = await bcrypt.hash( token, BCRYPT_SALT_ROUNDS )

		let row = await asyncDBGet( "SELECT usedGameTokens FROM accounts WHERE id = ?", [ id ] )

		let tokenHashArray = row.length == 0 ? [] : row.usedGameTokens.split( "," )
		tokenHashArray.push( hashedToken )

		let newRow = tokenHashArray.join( "," )
		await asyncDBRun( "UPDATE accounts SET usedGameTokens = ? WHERE id = ?", [ newRow, id ] )
	}
}
