const path = require( "path" )
const { PLAYER_NOT_FOUND } = require( "../shared/errorcodes.js" )
const { ParseDefinition, PdataToJsonUntyped } = require( "../shared/pjson.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )
const fs = require( "fs" )

const PLAYER_DATA_PDEF_231 = ParseDefinition( fs.readFileSync( "./persistent_player_data_version_231.pdef", "utf8" ) )

let translationsPath = path.join( __dirname, "translations.json" )

let translations = {}
if ( fs.existsSync( translationsPath ) )
{
	translations = JSON.parse( fs.readFileSync( translationsPath ).toString() )
	let keys = Object.keys( translations )

	keys.forEach( k=>
	{
		let kcode = k+"_code"
		let kname = k+"_name"
		translations[kcode] = Object.keys( translations[k] )
		translations[kname] =  Object.values( translations[k] )
	} )
	console.log( keys )

}

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /player/pdata
	// show pdata for a given player as json
	fastify.get( "/player/pdata",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }, // the id of the player to get stats of
				}
			}
		},
		async ( request ) =>
		{
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if( !account )
			{
				return { success: false, error: PLAYER_NOT_FOUND }
			}
			let pdata = PdataToJsonUntyped( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )
			return pdata
		} )

	// GET /player/info
	// show info for a given player as json
	fastify.get( "/player/info",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }, // the id of the player to get stats of
				}
			}
		},
		async ( request ) =>
		{
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if( !account )
			{
				return { success: false, error: PLAYER_NOT_FOUND }
			}
			let pdata = PdataToJsonUntyped( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )

			// define a filter for which properties are copied from the pdata
			let filter = ["gen", "xp", "activeCallingCardIndex", "activeCallsignIconIndex", "activeCallsignIconStyleIndex","lastTimePlayed", "netWorth", "factionChoice"]

			let pdataFiltered = Object.fromEntries(
				filter
					.map( key => [key, pdata[key]] )
			)

			let ret = {
				// name: account.username, // requires https://github.com/R2Northstar/NorthstarMasterServer/pull/42/
				id: account.id
			}
			Object.assign( ret, pdataFiltered )
			Object.assign( ret, {
				faction: {
					factionCode: pdata.factionChoice,
					factionName: translations.factions[pdata.factionChoice],
					factionXP: pdata.factionXP[translations.factions_code.indexOf( pdata.factionChoice )]
				}
			} )
			return ret
		} )

	// GET /player/stats
	// show stats for a given player as json
	fastify.get( "/player/stats",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }, // the id of the player to get stats of
				}
			}
		},
		async ( request ) =>
		{
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if( !account )
			{
				return { success: false, error: PLAYER_NOT_FOUND }
			}

			let pdata = PdataToJsonUntyped( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )

			// define a filter for which properties are copied from the pdata
			let filter = ["gen", "xp", "credits", "netWorth", "factionXP", "titanXP", "fdTitanXP", "gameStats", "mapStats", "timeStats",
						  "distanceStats", "weaponStats", "weaponKillStats", "killStats", "deathStats", "miscStats", "fdStats", "titanStats",
						  "kdratio_lifetime", "kdratio_lifetime_pvp", "winStreak", "highestWinStreakEver", ]

			let pdataFiltered = Object.fromEntries(
				filter
					.map( key => [key, pdata[key]] )
			)


			let wHours = pdataFiltered.weaponStats.map( key =>key.hoursUsed )
			let wKills = pdataFiltered.weaponKillStats.map( key =>key.total )


			let mostHours =  wHours.indexOf( Math.max( ...wHours ) )
			let mostKills = wKills.indexOf( Math.max( ...wKills ) )
			let ret = {
				id: account.id,
				mostUsedWeapon:{
					name:translations.weapons_name[mostHours],
					code:translations.weapons_code[mostHours],
					array_position: mostHours,
					time:wHours[mostHours],
					all:pdataFiltered.weaponStats[mostHours]
				},
				mostKillsWeapon:{
					name:translations.weapons_name[mostKills],
					code:translations.weapons_code[mostKills],
					array_position: mostKills,
					kills:wKills[mostKills],
					all:pdataFiltered.weaponKillStats[mostKills]
				}
			}
			Object.assign( ret, pdataFiltered )
			//Object.assign(ret, [wHours])

			return ret
		} )

	// GET /player/loadout
	// show louadout data for a given player as json
	fastify.get( "/player/loadout",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }, // the id of the player to get stats of
				}
			}
		},
		async ( request ) =>
		{
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if( !account )
			{
				return { success: false, error: PLAYER_NOT_FOUND }
			}
			let pdata = PdataToJsonUntyped( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )

			// define a filter for which properties are copied from the pdata
			let filter = ["factionChoice", "activePilotLoadout", "activeTitanLoadout", "pilotLoadouts", "titanLoadouts"]

			let pdataFiltered = Object.fromEntries(
				filter
					.map( key => [key, pdata[key]] )
			)

			let ret = {
				id: account.id
			}
			Object.assign( ret, pdataFiltered )

			return ret
		} )

	fastify.get( "/player/games",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }, // the id of the player to get stats of
				}
			}
		},
		async ( request ) =>
		{
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if( !account )
			{
				return { success: false, error: PLAYER_NOT_FOUND }
			}
			let pdata = PdataToJsonUntyped( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )

			// define a filter for which properties are copied from the pdata
			let filter = ["lastPlayList", "mapHistory", "modeHistory", "lastAbandonedMode", "lastAbandonTime"]

			let pdataFiltered = Object.fromEntries(
				filter
					.map( key => [key, pdata[key]] )
			)

			let ret = {
				id: account.id
			}
			Object.assign( ret, pdataFiltered )
			if( pdata.isPostGameScoreboardValid )
			{
				Object.assign( ret, {
					postGame: pdata.postGameData
				} )
			}

			return ret
		} )


	fastify.get( "/api/translations",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit

		},
		async ( ) =>
		{
			//let n = Object.fromEntries(translations.weapons_code.map( (key, index) => [key, translations.weapons_name[index]]))
			return translations
		} )
	done()
}

// might be useful at some point
// function StripPdataTypes( pdata )
// {
// 	if( typeof pdata != "object" ) return pdata
// 	let stripped = {}
// 	for( const [k, v] of Object.entries( pdata ) )
// 	{
// 		if( typeof v.value == "object" )
// 		{
// 			if( Array.isArray( v.value ) )
// 			{
// 				stripped[k] = v.value.map( val => StripPdataTypes( val ) )
// 			}
// 			else
// 			{
// 				stripped[k] = StripPdataTypes( v.value )
// 			}
// 		}
// 		else
// 		{
// 			stripped[k] = v.value
// 		}
// 	}
// 	return stripped
// }
