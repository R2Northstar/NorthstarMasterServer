const path = require( "path" )
const crypto = require( "crypto" )
const { GameServer, GetGameServers } = require( path.join( __dirname, "../shared/gameserver.js" ) )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) ) 
const asyncHttp = require( path.join( __dirname, "../shared/asynchttp.js" ) ) 

module.exports = ( fastify, opts, done ) => {
	// exported routes
	
	// POST /client/auth_with_server
	// attempts to authenticate a client with a gameserver, so they can connect
	fastify.post( '/client/auth_with_server', 
	{
		schema: {
			querystring: {
				id: { type: "string" }, // id of the player trying to auth
				//playerToken: { type: "string" }, // not implemented yet: the authing player's account token
				server: { type: "string" },
				password: { type: "string" } // the password the player is using to connect to the server
			}
		}
	},
	async ( request, reply ) => {
		let server = GetGameServers()[ request.query.server ]
		
		if ( !server || ( server.hasPassword && request.query.password != server.password ) )
			return { success: false }
		
		let account = await accounts.AsyncGetPlayerByID( request.query.id )
		if ( !account )
			return { success: false }
		
		// game doesnt seem to set serverFilter right if it's >31 chars long, so restrict it to 31
		let authToken = crypto.randomBytes( 16 ).toString("hex").substr( 0, 31 )
		
		let authResponse = await asyncHttp.request( { 
			method: "POST", 
			host: server.ip, 
			port: server.authPort, 
			path: `/authenticate_incoming_player?id=${request.query.id}&authToken=${authToken}`
		}, account.persistentData )
		
		if ( !authResponse )
			return { success: false }
		
		let jsonResponse = JSON.parse( authResponse.toString() )
		if ( !jsonResponse.success )
			return { success: false }
		
		return {
			success: true,
			
			ip: server.ip,
			port: server.port,
			authToken: authToken
		}
	})
	
	// POST /client/auth_with_self
	// attempts to authenticate a client with their own server, before the server is created
	// note: atm, this just sends pdata to clients and doesn't do any kind of auth stuff, potentially rewrite later
	fastify.post( '/client/auth_with_self',
	{
		schema: {
			querystring: {
				id: { type: "string" }, // id of the player trying to auth
				//playerToken: { type: "string" }, // not implemented yet: the authing player's account token
			}
		}
	},
	async ( request, reply ) => {
		let account = await accounts.AsyncGetPlayerByID( request.query.id )
		if ( !account )
		{
			// temp: autocreate accounts
			await accounts.AsyncCreateAccountForID( request.query.id )
			
			account = await accounts.AsyncGetPlayerByID( request.query.id )
			
			if ( !account )
				return { success: false }
		}
		
		// game doesnt seem to set serverFilter right if it's >31 chars long, so restrict it to 31
		let authToken = crypto.randomBytes( 16 ).toString("hex").substr( 0, 31 )
				
		return {
			success: true,
			
			id: account.id,
			authToken: authToken,
			// this fucking sucks, but i couldn't get game to behave if i sent it as an ascii string, so using this for now
			persistentData: Array.from( new Uint8Array( account.persistentData ) ) 
		}
	})
	
	done()
}