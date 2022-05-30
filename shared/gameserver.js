const crypto = require( "crypto" )
const { ParseModPDiffs } = require( "./pjson" )
const asyncHttp = require( "./asynchttp" )
const { QueryServerPort } = require( "./udp_query" )
const { updateServerList } = require( "./serverlist" )
const { DUPLICATE_SERVER, NO_GAMESERVER_RESPONSE, BAD_GAMESERVER_RESPONSE, JSON_PARSE_ERROR, UNAUTHORIZED_GAMESERVER } = require( "./errorcodes" )

const Filter = require( "bad-words" )
let filter = new Filter()

class GameServer
{
	// string name
	// string description
	// int playerCount
	// int maxPlayers
	// string map
	// string playlist

	// string ip
	// int port
	// int authPort

	// bool hasPassword
	// string password

	// object modInfo
	// object pdiff

	constructor( nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password = "", modInfo = { Mods: [] } )
	{
		if ( nameOrServer instanceof( GameServer ) ) // copy constructor
		{
			this.lastHeartbeat = nameOrServer.lastHeartbeat

			this.id = nameOrServer.id
			this.serverAuthToken = nameOrServer.serverAuthToken
			this.updateValues( nameOrServer.name, nameOrServer.description, nameOrServer.playerCount, nameOrServer.maxPlayers, nameOrServer.map, nameOrServer.playlist, nameOrServer.ip, nameOrServer.port, nameOrServer.authPort, nameOrServer.password, nameOrServer.modInfo, nameOrServer.pdiffs )
		}
		else // normal constructor
		{
			this.lastHeartbeat = Date.now()

			this.id = crypto.randomBytes( 16 ).toString( "hex" )
			this.serverAuthToken = crypto.randomBytes( 16 ).toString( "hex" )
			this.updateValues( nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo )
		}
	}

	updateValues( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo )
	{
		this.name = name
		this.description = description
		this.playerCount = Math.min( Math.max( parseInt( playerCount ), 0 ), 32 )
		this.maxPlayers = Math.min( Math.max( parseInt( maxPlayers ), 0 ), 32 )
		this.map = map
		this.playlist = playlist

		this.ip = ip
		this.port = port
		this.authPort = authPort

		this.hasPassword = false

		if ( password )
		{
			this.password = password
			this.hasPassword = true
		}

		// restrict modinfo keys
		this.modInfo = { Mods:[] }
		try
		{
			for ( let mod of modInfo.Mods )
				this.modInfo.Mods.push( { Name: mod.Name || "", Version: mod.Version || "0.0.0", RequiredOnClient: mod.RequiredOnClient || false, Pdiff: mod.Pdiff || null } )
		}
		catch( e )
		{
			// Do nothing
		}
	}
}

class GameServerGhost
{
	// string id
	// string ip
	// int port
	// int authPort

	// Date expiredAt

	constructor( server )
	{
		this.expiredAt = Date.now()

		this.id = server.id
		this.ip = server.ip
		this.port = server.port
		this.authPort = server.authPort
	}
}

let gameServers = {}
let gameServerGhosts = {}
let gameServerGhostTimeouts = {}

function GetGameServers()
{
	return gameServers
}
function AddGameServer( gameserver )
{
	gameServers[ gameserver.id ] = gameserver
}
function RemoveGameServer( gameserver )
{
	clearTimeout( gameServerGhostTimeouts[gameserver.id] )
	gameServerGhosts[gameserver.id] = new GameServerGhost( gameserver )
	gameServerGhostTimeouts[gameserver.id] = setTimeout( () =>
	{  // purge ghost after timeout
		RemoveGhostServer( gameserver.id )
	}, process.env.GAMESERVER_GHOST_TIMEOUT_MINS*60000 )
	delete gameServers[ gameserver.id ]
}

function GetGhostServer( id )
{
	return gameServerGhosts[id]
}
function HasGhostServer( id )
{
	return Object.hasOwn( gameServerGhosts, id )
}
function RemoveGhostServer( id )
{
	clearTimeout( gameServerGhostTimeouts[id] )
	delete gameServerGhostTimeouts[id]
	delete gameServerGhosts[id]
}

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
	GameServer,
	GameServerGhost,

	GetGameServers,
	AddGameServer,
	RemoveGameServer,
	GetGhostServer,
	HasGhostServer,
	RemoveGhostServer,

	TryVerifyServer,
	TryAddServer,
	TryReviveServer
}
