const path = require( "path" )
const { GameServer, GetGameServers, RemoveGameServer } = require( path.join( __dirname, "../shared/gameserver.js" ) )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) ) 

let shouldRequireSessionToken = process.env.REQUIRE_SESSION_TOKEN = true

module.exports = ( fastify, opts, done ) => {
	fastify.register(require( "fastify-cors" ))

	// exported routes
	
	// GET /client/servers 
	// returns a list of available servers
	fastify.get( '/client/servers', async ( request, response ) => {
		let displayServerArray = []
		let expiredServers = [] // might be better to move this to another function at some point, but easiest to do here atm
		
		let servers = Object.values( GetGameServers() )
				
		for ( let i = 0; i < servers.length; i++ )
		{			
			// prune servers if they've had 30 seconds since last heartbeat
			if ( Date.now() - servers[ i ].lastHeartbeat > 30000 )
			{
				expiredServers.push( servers[ i ] )
				continue
			}
			
			// don't show non-private_match servers on lobby since they'll pollute server list
			if ( servers[ i ].map == "mp_lobby" && servers[ i ].playlist != "private_match" )
				continue
			
			// create a copy of the gameserver obj for clients so we can hide sensitive info
			let copy = new GameServer( servers[ i ] )
			delete copy.ip
			delete copy.port
			delete copy.authPort
			delete copy.password
			delete copy.serverAuthToken
			
			displayServerArray.push( copy )
		}
		
		// delete servers that we've marked for deletion
		for ( let server of expiredServers )
			RemoveGameServer( server )
		
		return displayServerArray
	})
	
	// GET /client/servers_with_addresses
	// returns a list of available servers with their IP addresses if they are not password-protected
	fastify.get( '/client/servers_with_addresses', 
		{
		  schema: {
		    querystring: {
		      id: { type: "string" }, // id of the player trying to auth
		      playerToken: { type: "string" }, // not implemented yet: the authing player's account token
		    }
		  }
		},
		async ( request, response ) => {
		let displayServerArray = []
		let expiredServers = [] // might be better to move this to another function at some point, but easiest to do here atm
		
		let account = await accounts.AsyncGetPlayerByID( request.query.id )
		if ( !account )
		  return []

		if ( shouldRequireSessionToken )
		{
		  // check token
		  if ( request.query.playerToken != account.currentAuthToken )
		    return []

		  // check expired token
		  if ( account.currentAuthTokenExpirationTime < Date.now() )
		    return []
		}
		
		let servers = Object.values( GetGameServers() )
				
		for ( let i = 0; i < servers.length; i++ )
		{			
			// prune servers if they've had 30 seconds since last heartbeat
			if ( Date.now() - servers[ i ].lastHeartbeat > 30000 )
			{
				expiredServers.push( servers[ i ] )
				continue
			}
			
			// don't show non-private_match servers on lobby since they'll pollute server list
			if ( servers[ i ].map == "mp_lobby" && servers[ i ].playlist != "private_match" )
				continue
			
			// create a copy of the gameserver obj for clients so we can hide sensitive info
			let copy = new GameServer( servers[ i ] )
			if(copy.hasPassword) {
				delete copy.ip
			}
			delete copy.port
			delete copy.authPort
			delete copy.password
			
			displayServerArray.push( copy )
		}
		
		// delete servers that we've marked for deletion
		for ( let server of expiredServers )
			RemoveGameServer( server )
		
		return displayServerArray
	})
	
	done()
}
