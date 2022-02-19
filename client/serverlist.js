const path = require( "path" )
const { GameServer, GetGameServers, RemoveGameServer } = require( path.join( __dirname, "../shared/gameserver.js" ) )

const { getRatelimit } = require("../shared/ratelimit.js")
const { getLastChecked, getServerList, updateServerList } = require("../shared/serverlist_state.js")

module.exports = ( fastify, opts, done ) => {
	fastify.register(require( "fastify-cors" ))

	// exported routes

	// GET /client/servers
	// returns a list of available servers
	fastify.get( '/client/servers',
    {
		config: { rateLimit: getRatelimit("REQ_PER_MINUTE__CLIENT_SERVERS") }, // ratelimit
    },
	async ( request, response ) => {
		
		if (new Date().getTime() > getLastChecked + 1000) {
			updateServerList()
		}

		return getServerList()
	})

	done()
}