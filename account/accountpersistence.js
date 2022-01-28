const path = require( "path" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) ) 
const { broadcastEvent } = require('../sync/broadcast.js')

const { getRatelimit } = require("../shared/ratelimit.js")

module.exports = ( fastify, opts, done ) => {
	fastify.register( require( "fastify-multipart" ) )

	// exported routes

	// POST /accounts/write_persistence
	// attempts to write persistent data for a player
	// note: this is entirely insecure atm, at the very least, we should prevent it from being called on servers that the account being written to isn't currently connected to
	fastify.post( '/accounts/write_persistence',
	{
		config: { rateLimit: getRatelimit("REQ_PER_MINUTE__ACCOUNT_WRITEPERSISTENCE") }, // ratelimit
		schema: {
			querystring: {
				"id": { type: "string" },
				"serverId": { type: "string" }
			}
		},
	},
	async ( request, response ) => {

		let clientIp = request.ip

		// pull the client ip address from a custom header if one is specified
		if (process.env.CLIENT_IP_HEADER && request.headers[process.env.CLIENT_IP_HEADER])
			clientIp = request.headers[process.env.CLIENT_IP_HEADER]

		// check if account exists
		let account = await accounts.AsyncGetPlayerByID( request.query.id )
		if ( !account )
			return null

		// if the client is on their own server then don't check this since their own server might not be on masterserver
		if ( account.currentServerId == "self" ) {
			// if the ip sending the request isn't the same as the one that last authed using client/origin_auth then don't update
			if ( clientIp != account.lastAuthIp )
				return null
		} else {
			let server = GetGameServers()[ request.query.serverId ]
			// dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
			if ( !server || clientIp != server.ip || account.currentServerId != request.query.serverId )
				return null
		}

		// mostly temp
		let buf = await ( await request.file() ).toBuffer() 
		
		if ( buf.length == account.persistentDataBaseline.length ) {
			await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id, buf )
			broadcastEvent('playerWritePersistenceBaseline', { id: request.query.id, buf }) // data sharing
    }

		return null
	})

	done()
}
