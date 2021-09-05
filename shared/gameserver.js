const crypto = require( "crypto" )

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
	
	constructor( nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password = "" )
	{
		if ( nameOrServer instanceof( GameServer ) ) // copy constructor
		{
			this.lastHeartbeat = nameOrServer.lastHeartbeat
			
			this.id = nameOrServer.id
			this.updateValues(nameOrServer.name, nameOrServer.description, nameOrServer.playerCount, nameOrServer.maxPlayers, nameOrServer.map, nameOrServer.playlist, nameOrServer.ip, nameOrServer.port, nameOrServer.authPort, nameOrServer.password)
		}
		else // normal constructor
		{
			this.lastHeartbeat = Date.now()
			
			this.id = crypto.randomBytes(16).toString("hex")
			this.updateValues(nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password)
		}
	}

	updateValues( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password = "" )
	{
		this.name = name
		this.description = description
		this.playerCount = playerCount
		this.maxPlayers = maxPlayers
		this.map = map
		this.playlist = playlist
		
		this.ip = ip
		this.port = port
		this.authPort = authPort
		
		this.hasPassword = false
		if ( password != "" )
		{
			this.password = password
			this.hasPassword = true
		}
	}
}

let gameServers = {}

module.exports = {
	GameServer: GameServer,
	
	GetGameServers: function() { return gameServers },
	AddGameServer: function( gameserver ) { gameServers[ gameserver.id ] = gameserver },
	RemoveGameServer: function( gameserver ) { delete gameServers[ gameserver.id ] }
}