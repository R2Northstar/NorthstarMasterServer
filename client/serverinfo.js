const { getRatelimit } = require( "../shared/ratelimit.js" )
const { getServerList } = require( "../shared/serverlist_state.js" )
const { GameServer, GetGameServers, RemoveGameServer } = require( "../shared/gameserver.js" )


module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /client/server
	// returns a list of available servers
	fastify.get( "/client/serverinfo/*",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_SERVERS" ) }, // ratelimit
		},
		async (	request ) =>
		{
			id = request.url.substring(19)
			serverObj = GetGameServers()[id]
			if (serverObj != undefined) {
				return {success:true, info: serverObj}
			}
			else {
				return {success: false, info: {}}
			}
		} )

	done()
}
