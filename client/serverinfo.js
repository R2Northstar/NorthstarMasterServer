const { getRatelimit } = require( "../shared/ratelimit.js" )
const { GetGameServers } = require( "../shared/gameserver.js" )


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
			let id = request.url.substring( 19 )
			let serverObj = GetGameServers()[id]
			if ( serverObj != undefined )
			{
				delete serverObj.ip
				delete serverObj.port
				delete serverObj.authPort
				delete serverObj.password
				delete serverObj.serverAuthToken
				return { success:true, info: serverObj }
			}
			else
			{
				return { success: false, info: {} }
			}
		} )

	done()
}
