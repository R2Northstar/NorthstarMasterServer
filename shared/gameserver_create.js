const { ParseModPDiffs } = require( "./pjson" )
const asyncHttp = require( "./asynchttp" )
const { QueryServerPort } = require( "./udp_query" )
const { updateServerList } = require( "./serverlist" )
const { GameServer, GetGameServers, AddGameServer, GetGhostServer, RemoveGhostServer  } = require( "./gameserver_base" )
const { DUPLICATE_SERVER, NO_GAMESERVER_RESPONSE, BAD_GAMESERVER_RESPONSE, JSON_PARSE_ERROR, UNAUTHORIZED_GAMESERVER } = require( "./errorcodes" )

const Filter = require( "bad-words" )
let filter = new Filter()

const VERIFY_STRING = "I am a northstar server!"
async function TryVerifyServer( request )
{
	// check server's verify endpoint on their auth server, make sure it's fine
	// in the future we could probably check the server's connect port too, with a c2s_connect packet or smth, but atm this is good enough
	let authServerResponse
	try
	{
		authServerResponse = await asyncHttp.request( {
			method: "GET",
			host: request.ip,
			port: request.query.authPort,
			path: "/verify"
		} )
	}
	catch
	{
		return 2
	}

	if ( !authServerResponse || authServerResponse.toString() != VERIFY_STRING )
		return 1

	let gamePortDoesRespond = await QueryServerPort( request.ip, request.query.port )
	if( !gamePortDoesRespond ) return 1

	return 0
}


async function TryAddServer( request )
{
	let servers = GetGameServers()
	for ( let key in servers )
	{
		let server = servers[ key ]
		if ( server.ip == request.ip && server.port == request.query.port )
			return { success: false, error: DUPLICATE_SERVER }
	}

	let verifyStatus = await TryVerifyServer( request )
	if( verifyStatus == 1 ) return { success: false, error: NO_GAMESERVER_RESPONSE }
	if( verifyStatus == 2 ) return { success: false, error: BAD_GAMESERVER_RESPONSE }

	let modInfo = await ParseModPDiffs( request )
	if( !modInfo ) return { success: false, error: JSON_PARSE_ERROR }

	let playerCount = request.query.playerCount || 0
	if ( typeof playerCount == "string" )
		playerCount = parseInt( playerCount )

	if ( typeof request.query.maxPlayers == "string" )
		request.query.maxPlayers = parseInt( request.query.maxPlayers )

	if ( typeof request.query.port == "string" )
		request.query.port = parseInt( request.query.port )

	if ( typeof request.query.authPort == "string" )
		request.query.authPort = parseInt( request.query.authPort )

	let name = filter.clean( request.query.name )
	let description = request.query.description == "" ? "" : filter.clean( request.query.description )
	let newServer = new GameServer( name, description, playerCount, request.query.maxPlayers, request.query.map, request.query.playlist, request.ip, request.query.port, request.query.authPort, request.query.password, modInfo )
	AddGameServer( newServer )
	// console.log(`CREATE: (${newServer.id}) - ${newServer.name}`)
	updateServerList()

	return {
		success: true,
		id: newServer.id,
		serverAuthToken: newServer.serverAuthToken
	}
}

async function TryReviveServer( request )
{
	let ghost = GetGhostServer( request.query.id )

	if( request.ip != ghost.ip ) return { success: false, error: UNAUTHORIZED_GAMESERVER }

	let verifyStatus = await TryVerifyServer( request )
	if( verifyStatus == 1 ) return { success: false, error: NO_GAMESERVER_RESPONSE }
	if( verifyStatus == 2 ) return { success: false, error: BAD_GAMESERVER_RESPONSE }

	let modInfo = await ParseModPDiffs( request )
	if( !modInfo ) return { success: false, error: JSON_PARSE_ERROR }

	let playerCount = request.query.playerCount || 0
	if ( typeof playerCount == "string" )
		playerCount = parseInt( playerCount )

	if ( typeof request.query.maxPlayers == "string" )
		request.query.maxPlayers = parseInt( request.query.maxPlayers )

	let name = filter.clean( request.query.name )
	let description = request.query.description == "" ? "" : filter.clean( request.query.description )
	let newServer = new GameServer( name, description, playerCount, request.query.maxPlayers, request.query.map, request.query.playlist, request.ip, ghost.port, ghost.authPort, request.query.password, modInfo )
	newServer.id = ghost.id
	AddGameServer( newServer )
	RemoveGhostServer( ghost.id )
	// console.log(`CREATE: (${newServer.id}) - ${newServer.name}`)
	updateServerList()

	return {
		success: true,
		id: newServer.id,
		serverAuthToken: newServer.serverAuthToken
	}
}

module.exports = {
	TryVerifyServer,
	TryAddServer,
	TryReviveServer
}
