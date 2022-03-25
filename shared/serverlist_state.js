let serverList = []
let lastChecked = Date.now()

const { GameServer, GetGameServers, RemoveGameServer } = require( "../shared/gameserver.js" )

module.exports = {
	getLastChecked: function ()
	{
		return lastChecked
	},
	getServerList: function ()
	{
		return serverList
	},
	updateServerList: function ()
	{
		let displayServerArray = []
		let expiredServers = []
		let servers = Object.values( GetGameServers() )

		for ( let i = 0; i < servers.length; i++ )
		{
			// prune servers if they've had 30 seconds since last heartbeat
			if ( Date.now() - servers[ i ].lastHeartbeat > 30000 )
			{
				// console.log(`REMOVE: (${servers[i].id}) - ${servers[i].name}`)
				expiredServers.push( servers[ i ] )
				continue
			}

			// don't show non-private_match servers on lobby since they'll pollute server list
			if ( servers[ i ].map == "mp_lobby" && servers[ i ].playlist != "private_match" )
			{
				// console.log(`SKIP: (${servers[i].id}) - ${servers[i].name}`)
				continue
			}

			// create a copy of the gameserver obj for clients so we can hide sensitive info
			let copy = new GameServer( servers[ i ] )
			delete copy.ip
			delete copy.port
			delete copy.authPort
			delete copy.password
			delete copy.serverAuthToken

			// console.log(`ALLOW: (${servers[i].id}) - ${servers[i].name}`)
			displayServerArray.push( copy )
		}

		// delete servers that we've marked for deletion
		for ( let server of expiredServers )
			RemoveGameServer( server )

		serverList = displayServerArray
		lastChecked = Date.now()
	}
}
