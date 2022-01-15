const { getOwnSyncState, setReceivedSyncData } = require( "./syncutil.js" )
const accounts = require( "../shared/accounts.js" )
const { GameServer, GetGameServers, AddGameServer, UpdateGameServer } = require( "../shared/gameserver.js" )
const { setToken } = require( "./tokens.js" )
const { startSync } = require( "./broadcast.js" )
module.exports = {
	// eventName: async (data) => {
	//     try { 
	//         EVENT HANDLER
	//     } catch(e) {
	//         if(process.env.USE_DATASYNC_LOGGING) console.log(e)
	//     }
	// }
	syncData: async ( data ) =>
	{
		try
		{
			if( getOwnSyncState() == 2 ) return

			// Accounts
			let accountList = data.payload.accounts
			for( let accountJson of accountList )
			{
				let account = await accounts.AsyncGetPlayerByID( accountJson.id )
				if( accountJson.persistentDataBaseline ) accountJson.persistentDataBaseline = Buffer.from( accountJson.persistentDataBaseline )
				if ( !account ) // create account for user
				{
					if( process.env.USE_DATASYNC_LOGGER ) console.log( "- Creating account with id \""+accountJson.id+"\"" )
					await accounts.AsyncCreateAccountFromData( accountJson, accountJson.lastModified )
					account = await accounts.AsyncGetPlayerByID( accountJson.id )
				}
				else
				{
					if( accountJson.lastModified > account.lastModified )
					{
						if( process.env.USE_DATASYNC_LOGGER ) console.log( "- Updating account with id \""+accountJson.id+"\"" )
						accounts.AsyncUpdatePlayer( account.id, accountJson.account, accountJson.lastModified )
					}
					else
					{
						if( process.env.USE_DATASYNC_LOGGER ) console.log( "- Skipped account with id \""+accountJson.id+"\" (up-to-date, ts: "+accountJson.lastModified+">="+account.lastModified+")" )
					}
				}
			}

			// Servers
			let servers = data.payload.servers
			let currentServers = GetGameServers()
			for( let i = 0; i < Object.keys( servers ).length; i++ )
			{
				let id = Object.keys( servers )[i]
				if( currentServers[id] )
				{
					if( process.env.USE_DATASYNC_LOGGER ) console.log( "- Updating server with id \""+id+"\"" )
					UpdateGameServer( currentServers[id], servers[id], false )
				}
				else
				{
					if( process.env.USE_DATASYNC_LOGGER ) console.log( "- Creating server with id \""+id+"\"" )
					let { name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat, lastModified } = servers[id]
					let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
					newServer.id = id
					newServer.lastHeartbeat = lastHeartbeat
					newServer.lastModified = lastModified
					AddGameServer( newServer, false )
				}
			}

			setReceivedSyncData( true )
		}
		catch( e )
		{
			if( process.env.USE_DATASYNC_LOGGING ) console.log( e )
		}
	},
	requestSyncData: async ( data, reply ) =>
	{
		try
		{
			let accountList =  await accounts.AsyncGetAllPlayers()
			let servers = GetGameServers()

			reply( "syncData", { accounts: accountList, servers } )
		}
		catch( e )
		{
			if( process.env.USE_DATASYNC_LOGGING ) console.log( e )
		}
	},
	getState: async ( data, reply ) =>
	{
		try
		{
			reply( "getStateReply", { state: getOwnSyncState() } )
		}
		catch( e )
		{
			if( process.env.USE_DATASYNC_LOGGING ) console.log( e )
		}
	},
	getStateReply: async ( data, reply, ws ) =>
	{
		try
		{
			ws.syncState = data.payload.state
		}
		catch( e )
		{
			if( process.env.USE_DATASYNC_LOGGING ) console.log( e )
		}
	}
}
