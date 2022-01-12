const crypto = require( 'crypto' )
const instancing = require("../datasharing.js")

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
	
	constructor( nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password = "", modInfo = {} )
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
			this.lastModified = Date.now()

			this.id = crypto.randomBytes(16).toString( "hex" )
			this.serverAuthToken = crypto.randomBytes(16).toString( "hex" )
			this.updateValues( nameOrServer, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo )
		}
	}

	updateValues( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo )
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
		
		if ( !!password )
		{
			this.password = password
			this.hasPassword = true
		}

		// restrict modinfo keys
		this.modInfo = { Mods:[] }
		if ( !process.env.ALLOW_NON_MODINFO || modInfo && modInfo.Mods ) // if for some reason it's undefined we might as well just not run this
		{
			for ( let mod of modInfo.Mods )
				this.modInfo.Mods.push( { Name: mod.Name || "", Version: mod.Version || "0.0.0", RequiredOnClient: mod.RequiredOnClient || false, Pdiff: mod.Pdiff || null } )
		}
	}
}

let gameServers = {}

module.exports = {
	GameServer: GameServer,
	
	GetGameServers: function() { return gameServers },
	AddGameServer: function( gameserver, broadcast = true ) { 
		if(broadcast) instancing.serverAdd( gameserver ) // data sharing
		gameServers[ gameserver.id ] = gameserver
	},
	RemoveGameServer: function( gameserver, broadcast = true ) { 
		if(broadcast) instancing.serverRemove( gameserver ) // data sharing
		delete gameServers[ gameserver.id ]
	},
	UpdateGameServer: function( gameserver, data, broadcast = true ) {
		if(broadcast) instancing.serverUpdate( { gameserver, data } ) // data sharing
		for ( let key of Object.keys( data ) )
		{
			if ( key == "id" || key == "port" || key == "authport" || !( key in gameserver ) || data[ key ].length >= 512 )
				continue

			if ( key == "playerCount" || key == "maxPlayers" )
			{
				gameserver[ key ] = parseInt( data[ key ] )
			}
			else						//i suppose maybe add the brackets here to as upper one works with it. but actually its fine not to i guess.
			{
				gameserver[ key ] = data[ key ]
			}
		}
	}
}