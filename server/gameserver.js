const { GetGameServers, RemoveGameServer, HasGhostServer, TryAddServer, TryReviveServer } = require( "../shared/gameserver.js" )
const { minimumVersion } = require( "../shared/version.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const { updateServerList } = require( "../shared/serverlist.js" )
const { UNSUPPORTED_VERSION } = require( "../shared/errorcodes.js" )


module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// POST /server/add_server
	// adds a gameserver to the server list
	fastify.post( "/server/add_server",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__SERVER_ADDSERVER" ) }, // ratelimit
			schema: {
				querystring: {
					port: { type: "integer" }, // the port the gameserver is being hosted on ( for connect )
					authPort: { type: "integer" }, // the port the server's http auth server is being hosted on
					name: { type: "string" }, // the name of the server
					description: { type: "string" }, // the description of the server
					map: { type: "string" }, // the map the server is on
					playlist: { type: "string" }, // the playlist the server is using
					maxPlayers: { type: "integer" }, // the maximum number of players the server accepts
					password: { type: "string" } // the server's password, if 0 length, the server does not accept a password
				}
			}
		},
		async ( request ) =>
		{
			if( !minimumVersion( request ) )
				return { success: false, error: UNSUPPORTED_VERSION }

			return TryAddServer( request )
		} )


	// POST /server/update_values
	// updates values shown on the server list, such as map, playlist, or player count
	// no schema for this one, since it's fully dynamic and fastify doesnt do optional params
	fastify.post( "/server/update_values",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__SERVER_UPDATEVALUES" ) }, // ratelimit
		},
		async ( request ) =>
		{
			if ( !( "id" in request.query ) )
				return null

			let server = GetGameServers()[ request.query.id ]

			// if server doesn't exist, try adding it
			if ( !server )
			{
				if( HasGhostServer( request.query.id ) )
					return TryReviveServer( request )
				else
					return TryAddServer( request )
			}
			else if ( request.ip != server.ip ) // dont update if the server isnt the one sending the heartbeat
				return null

			for ( let key of Object.keys( request.query ) )
			{
				if ( key == "id" || key == "port" || key == "authport" || !( key in server ) || request.query[ key ].length >= 512 || typeof request.query[ key ] != "string" )
					continue

				if ( key == "playerCount" || key == "maxPlayers" )
				{
					server[ key ] = parseInt( request.query[ key ] )
				}
				else						//i suppose maybe add the brackets here to as upper one works with it. but actually its fine not to i guess.
				{
					server[ key ] = request.query[ key ]
				}
			}

			// update heartbeat
			server.lastHeartbeat = Date.now()

			return null
		} )

	// DELETE /server/remove_server
	// removes a gameserver from the server list
	fastify.delete( "/server/remove_server",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__SERVER_REMOVESERVER" ) }, // ratelimit
			schema: {
				querystring: {
					id: { type: "string" }
				}
			}
		},
		async ( request ) =>
		{
			let server = GetGameServers()[ request.query.id ]
			// dont remove if the server doesnt exist, or the server isnt the one sending the heartbeat
			if ( !server || request.ip != server.ip )
				return null

			RemoveGameServer( server )
			updateServerList()
			return null
		} )

	done()
}
