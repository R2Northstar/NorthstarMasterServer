const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const path = require( "path" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /servers
	fastify.get( "/servers",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			const stream = fs.createReadStream( path.join( __dirname, "../web/servers/index.html" ), "utf-8" )
			reply.type( "text/html" ).send( stream )
		} )

	done()
}
