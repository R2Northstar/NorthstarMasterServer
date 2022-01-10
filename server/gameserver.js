const path = require( "path" )
const crypto = require( "crypto" )
const { GameServer, GetGameServers, AddGameServer, RemoveGameServer } = require( path.join( __dirname, "../shared/gameserver.js" ) )
const asyncHttp = require( path.join( __dirname, "../shared/asynchttp.js" ) ) 
const pjson = require( path.join( __dirname, "../shared/pjson.js" ) )
const Filter = require('bad-words')
let filter = new Filter();

const VERIFY_STRING = "I am a northstar server!"

async function SharedTryAddServer( request )
{
	// check server's verify endpoint on their auth server, make sure it's fine
	// in the future we could probably check the server's connect port too, with a c2s_connect packet or smth, but atm this is good enough

	let hasValidModInfo = true
	let modInfo
	
	if ( request.isMultipart() )
	{
		try
		{
			modInfo = JSON.parse( ( await ( await request.file() ).toBuffer() ).toString() )
			hasValidModInfo = Array.isArray( modInfo.Mods )
		}
		catch ( ex ) {}
	}

	let authServerResponse = await asyncHttp.request( {
		method: "GET",
		host: request.ip,
		port: request.query.authPort,
		path: "/verify"
	})
	
	if ( !authServerResponse || authServerResponse.toString() != VERIFY_STRING )
		return { success: false }
	
	// pdiff stuff
	if ( modInfo && modInfo.Mods )
	{
		for ( let mod of modInfo.Mods )
		{
			if ( !!mod.pdiff )
			{
				try
				{
					let pdiffHash = crypto.createHash( "sha1" ).update( mod.pdiff ).digest( "hex" )
					mod.pdiff = pjson.ParseDefinitionDiffs( mod.pdiff )
					mod.pdiff.hash = pdiffHash
				}
				catch ( ex ) 
				{
					mod.pdiff = null
				}
			}
		}
	}

	let playerCount = request.query.playerCount || 0
	if ( typeof playerCount == 'string' )
		playerCount = parseInt( playerCount )

	if ( typeof request.query.maxPlayers == 'string' )
		request.query.maxPlayers = parseInt( request.query.maxPlayers )

	if ( typeof request.query.port == 'string' )
		request.query.port = parseInt( request.query.port )

	if ( typeof request.query.authPort == 'string' )
		request.query.authPort = parseInt( request.query.authPort ) 

	let name = filter.clean( request.query.name )
	let description = request.query.description == "" ? "" : filter.clean( request.query.description )
	let newServer = new GameServer( name, description, playerCount, request.query.maxPlayers, request.query.map, request.query.playlist, request.ip, request.query.port, request.query.authPort, request.query.password, modInfo )
	AddGameServer( newServer )

	return {
		success: true,
		id: newServer.id,
		serverAuthToken: newServer.serverAuthToken
	}
}

module.exports = ( fastify, opts, done ) => {
	fastify.register( require( "fastify-multipart" ) )

	// exported routes
	
	// POST /server/add_server
	// adds a gameserver to the server list
	fastify.post( '/server/add_server', 
	{
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
	async ( request, reply ) => {
		return SharedTryAddServer( request )
	})
	
	// POST /server/heartbeat
	// refreshes a gameserver's last heartbeat time, gameservers are removed after 30 seconds without a heartbeat
	fastify.post( '/server/heartbeat',
	{
		schema: {
			querystring: {
				id: { type: "string" }, // the id of the server sending this message
				playerCount: { type: "integer" }
			}
		}
	},
	async ( request, reply ) => {
		let server = GetGameServers()[ request.query.id ]
		// dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
		if ( !server || request.ip != server.ip || !request.query.id )// remove !request.playerCount as if playercount==0 it will trigger skip heartbeat update
		{
			return null
		}
		
		else								// Added else so update heartbeat will trigger,Have to add the brackets for me to work for some reason
		{
			server.lastHeartbeat = Date.now()
			server.playerCount = request.query.playerCount
			return null
		}
	})
	
	// POST /server/update_values
	// updates values shown on the server list, such as map, playlist, or player count
	// no schema for this one, since it's fully dynamic and fastify doesnt do optional params
	fastify.post( '/server/update_values', async ( request, reply ) => {
		if ( !( "id" in request.query ) )
			return null
		
		let server = GetGameServers()[ request.query.id ]

		// if server doesn't exist, try adding it
		if ( !server )
		{
			return SharedTryAddServer( request )
		}
		else if ( request.ip != server.ip ) // dont update if the server isnt the one sending the heartbeat
			return null

		// update heartbeat
		server.lastHeartbeat = Date.now()
		
		for ( let key of Object.keys( request.query ) )
		{
			if ( key == "id" || key == "port" || key == "authport" || !( key in server ) || request.query[ key ].length >= 512 )
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
		
		return null
	})
	
	// DELETE /server/remove_server 
	// removes a gameserver from the server list
	fastify.delete( '/server/remove_server',
	{
		schema: {
			querystring: {
				id: { type: "string" }
			}
		}
	},
	async ( request, reply ) => {
		let server = GetGameServers()[ request.query.id ]
		// dont remove if the server doesnt exist, or the server isnt the one sending the heartbeat
		if ( !server || request.ip != server.ip )
			return null
		
		RemoveGameServer( server )
		return null
	})
	
	done()
}