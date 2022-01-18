// Sync.js is responsible for handling all the actual sync messages sent within the network
// It contains the message handlers for all types of sync messages

const { getOwnSyncState, setReceivedSyncData } = require( "./syncutil.js" )
const accounts = require( "../shared/accounts.js" )
const { GameServer, GetGameServers, AddGameServer, UpdateGameServer } = require( "../shared/gameserver.js" )
const { addNetworkNode, getNetworkNodes } = require("./network.js")
const { logSync } = require("../logging.js")

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
					logSync( "- Creating account with id \""+accountJson.id+"\"", 3)
					await accounts.AsyncCreateAccountFromData( accountJson, accountJson.lastModified )
					account = await accounts.AsyncGetPlayerByID( accountJson.id )
				}
				else
				{
					if( accountJson.lastModified > account.lastModified )
					{
						logSync( "- Updating account with id \""+accountJson.id+"\"", 3 )
						accounts.AsyncUpdatePlayer( account.id, accountJson.account, accountJson.lastModified )
					}
					else
					{
						logSync( "- Skipped account with id \""+accountJson.id+"\" (up-to-date, ts: "+accountJson.lastModified+">="+account.lastModified+")" , 3)
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
					logSync( "- Updating server with id \""+id+"\"" , 3)
					UpdateGameServer( currentServers[id], servers[id], false )
				}
				else
				{
					logSync( "- Creating server with id \""+id+"\"" , 3)
					let { name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat, lastModified, serverAuthToken } = servers[id]
					let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
					newServer.id = id
					newServer.lastHeartbeat = lastHeartbeat
					newServer.lastModified = lastModified
					newServer.serverAuthToken = serverAuthToken
					AddGameServer( newServer, false )
				}
			}

			setReceivedSyncData( true )
		}
		catch( e )
		{
			logSync( e, 1, type="error" )
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
			logSync( e, 1, type="error" )
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
			logSync( e, 1, type="error" )
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
			logSync( e, 1, type="error" )
		}
	},
	addNetworkNode: async (data) => {
		let payload = data.payload
		try { 
			addNetworkNode(payload.id, payload.token)
			logSync("Updated network! Current network: " + Object.keys(await getNetworkNodes()), 3)
		} catch(e) {
			logSync( e, 1, type="error" )
		}
	}
}
