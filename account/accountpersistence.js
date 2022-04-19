const path = require( "path" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )
const modPersistence = require( path.join( __dirname, "../shared/modPersistentData.js" ) )

const { GetGameServers } = require( "../shared/gameserver.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// POST /accounts/write_persistence
	// attempts to write persistent data for a player
	// note: this is entirely insecure atm, at the very least, we should prevent it from being called on servers that the account being written to isn't currently connected to
	fastify.post( "/accounts/write_persistence",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__ACCOUNT_WRITEPERSISTENCE" ) }, // ratelimit
			schema: {
				querystring: {
					"id": { type: "string" },
					"serverId": { type: "string" }
				}
			},
		},
		async ( request ) =>
		{
		// check if account exists 
			let account = await accounts.AsyncGetPlayerByID( request.query.id )
			if ( !account )
				return null

			// if the client is on their own server then don't check this since their own server might not be on masterserver
			if ( account.currentServerId == "self" )
			{
			// if the ip sending the request isn't the same as the one that last authed using client/origin_auth then don't update
				if ( request.ip != account.lastAuthIp )
					return null
			}
			else
			{
				let server = GetGameServers()[ request.query.serverId ]
				// dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
				if ( !server || request.ip != server.ip || account.currentServerId != request.query.serverId )
					return null
			}

			// mostly temp
			let buf = await ( await request.file() ).toBuffer()

			// check if server has any pdiff
			// this might be a bit unsafe? some pdiff might just override something and therefore not change the length, better implementation would be to check if any server mods implement pdiff
			if ( buf.length == account.persistentDataBaseline.length )
			{
				await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id, buf )
			}
			else
			{
				let persistenceJSON = await modPersistence.AsyncModPersistenceBufferToJson( GetGameServers()[ request.query.serverId ], request.query.id, buf )
				//await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id,  persistenceJSON.baseline )
				for ( let pdiff of persistenceJSON.pdiffs )
				{
					await modPersistence.AsyncWritePlayerModPersistence( request.query.id, pdiff.hash, JSON.stringify( pdiff.data ) )
				}
			}

			return null
		} )

	done()
}
