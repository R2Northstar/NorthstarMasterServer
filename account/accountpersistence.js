const path = require( "path" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )
const modPersistence = require( path.join( __dirname, "../shared/modPersistentData.js" ) )

const { GetGameServers } = require( "../shared/gameserver.js" )
//const { AsyncGetPlayerPersistenceBufferForMods } = require("../shared/modPersistentData.js")
//const { PdataToJson } = require("../shared/pjson.js")
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
				var server = GetGameServers()[ request.query.serverId ]
				// dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
				if ( !server || request.ip != server.ip || account.currentServerId != request.query.serverId )
					return null
			}
			if ( !request.isMultipart() )
			{
				console.log( "request is not multipart" )
				return null
			}

			let files = await request.files()
			let file1
			let file2
			try
			{
				for await ( const part of files )
				{
					if ( !part )
						continue
					if ( ( part.fieldname ) == "pdata" )
					{
						file1 = part
						console.log( "found pdata" )
					}
					else if ( ( part.fieldname ) == "modinfo" )
					{
						file2 = part
						console.log( "found modinfo" )
					}
					else
					{
						console.log( "UNKNOWN PART" )
						console.log( part.fieldname )
					}
					if ( file1 && file2 )
						break
				}
			}
			catch ( ex )
			{
				console.log( ex )
			}

			let modInfo = JSON.parse( ( await ( await file2 ).toBuffer() ).toString() )

			// mostly temp
			let buf = ( await ( await file1 ).toBuffer() )

			// check if server has any pdiff
			// this might be a bit unsafe? some pdiff might just override something and therefore not change the length, better implementation would be to check if any server mods implement pdiff
			console.log ( buf.length )
			console.log ( account.persistentDataBaseline.length )
			if ( buf.length == account.persistentDataBaseline.length )
			{
				console.log( "no mod pdiffs found, writing baseline" )
				await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id, buf )
			}
			else
			{
				console.log( "mod pdiffs found" )
				let persistenceJSON = await modPersistence.AsyncModPersistenceBufferToJson( modInfo, request.query.id, buf )
				//await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id,  persistenceJSON.baseline )
				console.log( "writing pdiff data" )
				for ( let pdiff of persistenceJSON.pdiffs )
				{
					console.log( pdiff.data )
					// commenting for now while i rewrite the reading of pdiffs
					await modPersistence.AsyncWritePlayerModPersistence( request.query.id, pdiff.hash, JSON.stringify( pdiff.data ) )
				}
				console.log( "writing persistence baseline" )
				await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id, persistenceJSON.baseline )
			}

			return null
		} )

	done()
}
