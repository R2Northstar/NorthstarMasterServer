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

	AsyncWritePlayerModPersistence: async function AsyncWritePlayerModPersistence( id, pdiffHash, data )
	{
		await asyncDBRun( "UPDATE modPersistentData SET data = ? WHERE id = ? AND pdiffHash = ?", [ data, id, pdiffHash ] )
		console.log( "successfully written pdiff data" )
	},

	AsyncModPersistenceBufferToJson: async function AsyncModPersistenceBufferToJson( modInfo, playerID, buffer )
	{
		// this returns an object in the form
		/*
		{
			baseline: <baseline> // this is the vanilla persistence, that we will write like normal (as a buffer)
			pdiffs: // array of all the mods and the persistence data they have stored
			[
				{
					hash: <hash>, // hashed string 
					data: <data>,  // Object
					pdef: <pdef> // Object (just used for temp storage tbh)
				},
				{
					hash: <hash>, // hashed string 
					data: <data>,  // Object
					pdef: <pdef> // Object (just used for temp storage tbh)
				},
				...
			]
		}
		*/

		let ret = {
			pdiffs: []
		}

		let pdiffs = modInfo.Mods.filter( m => !!m.Pdiff ).map( m => m.Pdiff )

		//
		let pdefCopy = DEFAULT_PDEF_OBJECT
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
			ret.pdiffs.push( { hash: pdiff.hash, pdef: pdiff.pdef, data: {} } )
		}

		let parsed = pjson.PdataToJson( buffer, pdefCopy )

		// remove all keys that are the same as the stored pdata (makes my life easier)
		// or not.
		let player = await ( module.exports.AsyncGetPlayerByID( playerID ) )//.persistentDataBaseline
		let vanillaPdata = await pjson.PdataToJson( player.persistentDataBaseline, DEFAULT_PDEF_OBJECT )
		//let copiedVanilla = JSON.parse( JSON.stringify( vanillaPdata ) )

		// THIS IS BAD AND SHOULD RECURSE


		// iterate through the keys
		Object.keys( parsed ).forEach( key =>
		{
			// THIS IS PROBABLY MISSING SOME CASES

			// if key is directly added by a mod, add it to the mod's pdiff object
			let found = false
			ret.pdiffs.forEach( pdiff =>
			{
				pdiff.pdef.members.forEach( member =>
				{
					if ( key == member.name )
					{
						console.log( "key is a member defined in a pdiff" )

						console.log( key )
						console.log( parsed[key] )
						// this is currently adding it to *all* pdiffs that add the member, which is not ideal i don't think?
						// potential for two mods to have the same member, but implemented differently
						pdiff.data[key] = parsed[key]
						found = true
					}
				} )
			} )
			if ( found )
			{
				return // we have dealt with this key
			}
			// else if key is an enum member that is added by a mod, put it in the mod's pdiff object
			let type = parsed[key].type
			ret.pdiffs.forEach( pdiff =>
			{
				if ( typeof pdiff.pdef.enums[type] != "undefined" && pdiff.pdef.enums[type].includes( parsed[key].value ) ) // enums contains the type
				{
					console.log( "key is an enum member" )
					console.log( key )

					console.log( pdiff.pdef )
					console.log( parsed[key].value )

					pdiff.data[key] = parsed[key]
					found = true
				}

			} )
			if ( found )
			{
				return // we have dealt with this key
			}
			// else add to vanilla pdiff object
			vanillaPdata[key] = parsed[key]
			console.log( "key is not modded" )
			console.log( key )
		} )
		console.log( "HELLO WORLD" )
		ret.baseline = pjson.PdataJsonToBuffer( vanillaPdata, DEFAULT_PDEF_OBJECT )

		// THIS IS OLD STUFF I THINK

		// split into baseline data and pdiff
		// pdataCopy will be a vanilla compatible object
		/*let pdataCopy = {}
		// maybe manually copying wont pass by reference
		Object.keys( parsed ).forEach( key =>
		{
			pdataCopy[key] = parsed[key]
		} )
		ret.pdiffs.forEach( pdiff =>
		{
			try
			{
				// iterate through members of the pdiff definitions
				pdiff.pdef.members.forEach( pdiffMember =>
				{
					// find the member in the parsed pdata
					let found = false

					Object.keys( parsed ).forEach( parsedMemberName =>
					{
						if ( !found && parsedMemberName == pdiffMember.name )
						{
							found = true
							delete pdataCopy[parsedMemberName]
							if ( pdiff.data == undefined )
							{
								pdiff.data = {}
							}
							/*pdiffMember.value = parsed[parsedMemberName].value
							pdiffMember.value = parsed[parsedMemberName].value
							let passThis = {}
							passThis[result.name] = { type: result.type, arraySize: result.arraySize, nativeArraySize: result.nativeArraySize, value: result.value}
							pdiff.data[parsedMemberName] = parsed[parsedMemberName]
						}
					} )
				} )
			}
			catch ( ex )
			{
				console.log( ex )
			}
		} )

		// remove all pdiff keys
		// check remaining json to see if we need to store anything else
		// get baseline data from db
		// replace all baseline data from db that we can
		// write resulting baseline data to db (buffer)
		// write pdiff data to db (json)
		// let baseline = pjson.PdataToJson( await ( await ( this.AsyncGetPlayerByID( playerID ) ) ).persistentDataBaseline, DEFAULT_PDEF_OBJECT )
		//console.log( baseline )

		*/
		return ret
	},

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

			// add to the enums
			for ( let enumAdd in pdiff.enumAdds )
			{
				pdefCopy.enums[ enumAdd ] = pdefCopy.enums[ enumAdd ].concat( pdiff.enumAdds[ enumAdd ] )
			}
			pdefCopy = objCombine( pdefCopy, pdiff.pdef )
			let result = await module.exports.AsyncGetPlayerModPersistence( id, pdiff.hash )
			console.log( result )

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

	}
}

function objCombine( target, object )
{
	let combined = {}

	Object.keys( target ).forEach( key =>
	{
		if ( Array.isArray( target[key] ) )
		{
			if ( combined[key] == null )
				combined[key] = []

			// i dont see a nice way that we can override members, then again, you shouldn't ever need to? like what would be the point
			// i did the not-nice thing because i think we need to be able to override members for cases where pdiffs change, say a loadout index
			// this could make that loadout index not valid in non-modded pdata, for pdiff we split this into being stored in pdiff data
			// therefore we need to be able to override a member to load that pdiff data
			target[key].forEach( innerKey =>
			{
				let hasReplaced = false
				// try and replace a key in the combined object, if we can't replace, add to the end
				combined[key].forEach( otherKey =>
				{
					if ( !hasReplaced && otherKey.name == innerKey.name )
					{
						hasReplaced = true
						otherKey = innerKey
					}
				} )
				if ( !hasReplaced )
					combined[ key ].push( innerKey )

			} )
		}
		else
		{
			if ( combined[key] == null )
				combined[key] = {}
			Object.assign( combined[key], target[key] )
		}
	} )

	Object.keys( object ).forEach( key =>
	{
		if ( Array.isArray( object[key] ) )
		{
			if ( combined[key] == null )
				combined[key] = []
			object[key].forEach( innerKey =>
			{
				let hasReplaced = false
				// try and replace a key in the combined object, if we can't replace, add to the end
				combined[key].forEach( otherKey =>
				{
					if ( !hasReplaced && otherKey.name == innerKey.name )
					{
						hasReplaced = true
						otherKey = innerKey
					}
				} )
				if ( !hasReplaced )
					combined[ key ].push( innerKey )
			} )
		}
		else
		{
			if ( combined[key] == null )
				combined[key] = {}
			Object.assign( combined[key], object[key] )
		}
	} )

	return combined
}


