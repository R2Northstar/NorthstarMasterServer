const { getRatelimit } = require( "../shared/ratelimit.js" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /invite/server/*
	// Redirect for invites
	fastify.get( "/invite/server/*",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			reply.redirect( "northstar://server@" + request.url.substring( 15 ) )
		} )
	done()
}
