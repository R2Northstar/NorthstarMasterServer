const path = require( "path" )
const { PLAYER_NOT_FOUND } = require( "../shared/errorcodes.js" )
const { PdataToJson, ParseDefinition } = require( "../shared/pjson.js" )
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
			let pDataJson = PdataToJson( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )
			return pDataJson
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
			let pDataJson = PdataToJson( account.persistentDataBaseline, PLAYER_DATA_PDEF_231 )
			return {
				// name: account.username, // requires https://github.com/R2Northstar/NorthstarMasterServer/pull/42/
				id: account.id,
				gen: pDataJson.gen.value,
				xp: pDataJson.xp.value,
				activeCallingCardIndex: pDataJson.activeCallingCardIndex.value,
				activeCallsignIconIndex: pDataJson.activeCallsignIconIndex.value,
				activeCallsignIconStyleIndex: pDataJson.activeCallsignIconStyleIndex.value,
				netWorth: pDataJson.netWorth.value
			}
		} )

	done()
}
