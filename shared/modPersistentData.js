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

		var pdefCopy = JSON.parse( JSON.stringify( DEFAULT_PDEF_OBJECT ) )

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

			for ( let enumAdd in pdiff.enumAdds )
			{
				pdefCopy.enums[ enumAdd ] = pdefCopy.enums[ enumAdd ].concat( pdiff.enumAdds[ enumAdd ] )
			}
			pdefCopy = objCombine( pdefCopy, pdiff.pdef )
			ret.pdiffs.push( { hash: pdiff.hash, pdef: pdiff.pdef, enumAdds: pdiff.enumAdds, data: {} } )
		}

		let parsed = pjson.PdataToJson( buffer, pdefCopy )

		// get the vanilla pdata we are already storing in the DB for the player, we will make changes to this and re-write it to the DB
		let player = await ( module.exports.AsyncGetPlayerByID( playerID ) )
		let vanillaPdata = await pjson.PdataToJson( player.persistentDataBaseline, JSON.parse( JSON.stringify( DEFAULT_PDEF_OBJECT ) ) )

		// recurse through all of the members of the vanilla pdata and get the respective values from the parsed pdata
		// this will hopefully make any pdiffs safe as long as they dont do bad pdata stuff in script (which hopefully they wont but i cant stop them)
		function RecursiveGetVanillaPdata( vanilla, pdata, key )
		{
			if ( JSON.stringify( vanilla.value ) != JSON.stringify( pdata.value ) )
			{
				console.log( "'" + key + "' has been changed" )
			}
			else
			{
				// if it's not been changed, no point in doing anything
				return
			}

			// native type
			if ( ["int", "float", "bool", "string" ].includes( vanilla.type ) )
			{
				// not an array
				if ( Object.keys( vanilla.value ).length == 0 )
				{
					// should be safe to copy over here
					vanilla.value = pdata.value
				}
				else
				{
					// copy over only the amount of values we need, ignore any extras
					Object.keys( vanilla.value ).forEach( valueKey =>
					{
						// should be safe to copy over here
						vanilla.value[valueKey] = pdata.value[valueKey]
					} )
				}
				return
			}


			// enum member
			if ( Object.keys( DEFAULT_PDEF_OBJECT.enums ).includes( vanilla.type ) )
			{
				let vanillaPdefEnum = DEFAULT_PDEF_OBJECT.enums[vanilla.type]
				// check that it wasnt added by an enumAdd
				if ( vanillaPdefEnum.includes( pdata.value ) )
					vanilla.value = pdata.value
				else
					console.log( "Not writing to vanilla pdata: Enum member is not present in the enum '" + vanilla.type + "'" )
				return
			}

			// array
			if ( typeof( vanilla.arraySize ) != "undefined" )
			{
				Object.keys( vanilla.value ).forEach( arrayKey =>
				{
					if ( JSON.stringify( vanilla.value[arrayKey] ) != JSON.stringify( pdata.value[arrayKey] ) )
					{
						console.log( "Index '" + arrayKey + "' has been changed" )
					}
					else
					{
						return
					}

					// shouldnt be any possibility of vanilla array length being more than modded array length, as they can only add to enums, and other arrays are hardcoded size
					let vanillaMember = vanilla.value[arrayKey]
					let pdataMember = pdata.value[arrayKey]

					// if the array is just of native types/enum members
					if ( ["int", "float", "bool", "string" ].concat( Object.keys( DEFAULT_PDEF_OBJECT.enums ) ).includes( vanilla.type ) )
					{
						// we already handled arrays of native types so this must be an enum member array i think?
						let vanillaPdefEnum = DEFAULT_PDEF_OBJECT.enums[vanilla.type]

						// copy over only the amount of values we need, ignore any extras
						Object.keys( vanilla.value ).forEach( valueKey =>
						{
							// check that it wasnt added by an enumAdd
							if ( vanillaPdefEnum.includes( pdata.value[valueKey] ) )
								vanilla.value[valueKey] = pdata.value[valueKey]
							else
								console.log( "Not writing to vanilla pdata: Enum member is not present in the enum '" + vanilla.type + "'" )
						} )
					}
					// if the array is of a struct
					else
					{
						Object.keys( vanillaMember ).forEach( vanillaMemberKey =>
						{
							RecursiveGetVanillaPdata( vanillaMember[vanillaMemberKey], pdataMember[vanillaMemberKey], vanillaMemberKey )
						} )
					}
				} )
				return
			}

			// not an array or anything, so must be a singleton struct?
			Object.keys( vanilla.value ).forEach( vanillaKey =>
			{
				RecursiveGetVanillaPdata( vanilla.value[vanillaKey], pdata.value[vanillaKey], vanillaKey )
			} )
		}

		// construct the vanilla pdata 
		Object.keys( vanillaPdata ).forEach( key =>
		{
			RecursiveGetVanillaPdata( vanillaPdata[key], parsed[key], key )
		} )

		// convert the vanilla pdata to buffer and put it in ret.baseline to be written
		ret.baseline = pjson.PdataJsonToBuffer( vanillaPdata, JSON.parse( JSON.stringify( DEFAULT_PDEF_OBJECT ) ) )

		// handle the actual pdiff data here

		return ret
	},

	// eslint-disable-next-line
	AsyncGetPlayerPersistenceBufferForMods: async function( id, pdiffs )
	{
		let player = await module.exports.AsyncGetPlayerByID( id )
		//return player.persistentDataBaseline

		let pdefCopy = JSON.parse( JSON.stringify( DEFAULT_PDEF_OBJECT ) )
		let baselineJson = pjson.PdataToJson( player.persistentDataBaseline, JSON.parse( JSON.stringify( DEFAULT_PDEF_OBJECT ) ) )

		let newPdataJson = baselineJson

		if ( !player )
			return null

		// iterate through the mods which have pdiffs
		for ( let pdiffstr of pdiffs )
		{
			// get the hash and pdef for the pdiff so we can get the data and splice it properly
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

			// add to the enums in the vanilla pdef
			for ( let enumAdd in pdiff.enumAdds )
			{
				pdefCopy.enums[ enumAdd ] = pdefCopy.enums[ enumAdd ].concat( pdiff.enumAdds[ enumAdd ] )
			}

			// This looks fine, don't really think it needs changing
			pdefCopy = objCombine( pdefCopy, pdiff.pdef )

			// example of result: {"moddedPilotWeapons":{"mp_weapon_peacekraber":"..."}}
			// second example: {"isPDiffWorking":1}}
			// TODO: support dot notation in the member names i.e ranked.isPlayingRanked
			// this format allows for dynamic editing of arrays with dynamic size
			// including the type in this json is irrelevant as we can get that from the pdef anyway
			let result = await module.exports.AsyncGetPlayerModPersistence( id, pdiff.hash )

			// iterate through the members of the data
			Object.keys( result ).forEach( pdiffMemberKey =>
			{
				let pdefObject
				pdefCopy.members.forEach( member =>
				{
					if ( member.name === pdiffMemberKey )
						pdefObject = member
				} )
				console.assert( pdefObject !== undefined, "Could not find key '" + pdiffMemberKey + "' in pdef" )

				// if this is not an array
				if ( pdefObject.arraySize === undefined )
				{
					// construct the Object that we are going to write to newPdataJson

					// get info from the pdiff pdef
					let write = { arraySize: pdefObject.arraySize, nativeArraySize: pdefObject.nativeArraySize, type: pdefObject.type }
					// get info from the pdiff data
					write.value = result[pdiffMemberKey]

					// write the value
					// we dont even check if the key exists or not here because we are kinda just blindly overriding, would be the mods fault if they break shit
					newPdataJson[pdiffMemberKey] = write
				}
				// if this is an array
				else
				{
					// construct base Object for the array (if needed)
					if ( newPdataJson[pdiffMemberKey] === undefined )
					{
						// get data from the pdef
						let length = pdefObject.arraySize
						if ( isNaN( Number( length ) ) )
						{
							length = pdefCopy.enums[pdefObject.arraySize].length
						}
						let write = { arraySize: length, nativeArraySize: pdefObject.nativeArraySize, type: pdefObject.type }
						write.value = []
						newPdataJson[pdiffMemberKey] = write
					}
					// iterate through each member of the array
					Object.keys( result[pdiffMemberKey] ).forEach( pdiffMemberDataKey =>
					{
						// convert the key into an index for the array
						let pdiffMemberDataKey_Number = Number( pdiffMemberDataKey )
						// i think this is safe because i dont think you can use numbers in enums for pdefs (game crashes afaik)
						// check if the key is actually an enum member
						if ( isNaN( pdiffMemberDataKey_Number ) )
						{
							// get the key's index from the enum
							for ( let i = 0; i < pdefCopy.enums[pdefObject.arraySize].length; i++ )
							{
								if ( pdefCopy.enums[pdefObject.arraySize][i] == pdiffMemberDataKey )
								{
									pdiffMemberDataKey_Number = i
									break
								}
							}
							console.assert( !isNaN( pdiffMemberDataKey_Number ), "Pdiff member's key '" + pdiffMemberDataKey + "' is not in the enum '" + pdefObject.arraySize + "'" )
						}
						// write the value
						newPdataJson[pdiffMemberKey].value[pdiffMemberDataKey_Number] = result[pdiffMemberKey][pdiffMemberDataKey]
					} )
				}
			}, { newPdataJson: newPdataJson } )

		}
		// SEEMS TO WORK UP TO HERE

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


