const path = require( "path" )
const { PLAYER_NOT_FOUND } = require( "../shared/errorcodes.js" )
const { ParseDefinition, PdataToJsonUntyped } = require( "../shared/pjson.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )
const fs = require( "fs" )

const PLAYER_DATA_PDEF_231 = ParseDefinition( fs.readFileSync( "./persistent_player_data_version_231.pdef", "utf8" ) )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /player/pdata
	// show pdata for a given player as json
	fastify.get( "/player/pdata",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__PLAYER_DATA" ) }, // ratelimit
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
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__PLAYER_DATA" ) }, // ratelimit
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
			let filter = ["gen", "xp", "activeCallingCardIndex", "activeCallsignIconIndex", "activeCallsignIconStyleIndex", "netWorth"]

			let pdataFiltered = Object.fromEntries(
				filter
					.map( key => [key, pdata[key]] )
			)

			let ret = {
				name: account.username,
				id: account.id
			}
			Object.assign( ret, pdataFiltered )

			return ret
		} )

	// GET /player/stats
	// show stats for a given player as json
	fastify.get( "/player/stats",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__PLAYER_DATA" ) }, // ratelimit
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

			let ret = {
				id: account.id
			}
			Object.assign( ret, pdataFiltered )

			return ret
		} )

	// GET /player/loadout
	// show louadout data for a given player as json
	fastify.get( "/player/loadout",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__PLAYER_DATA" ) }, // ratelimit
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
