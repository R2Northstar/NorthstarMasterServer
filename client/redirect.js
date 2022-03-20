const { getRatelimit } = require( "../shared/ratelimit.js" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /
	// redirect anyone going to northstar.tf/github in a browser to the github
	fastify.get( "/github",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			reply.redirect( "https://github.com/R2Northstar" )
		} )

	// GET /discord
	// redirect anyone going to northstar.tf/discord to the discord
	fastify.get( "/discord",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			reply.redirect( "https://discord.gg/northstar" )
		} )

	// GET /wiki
	// redirect anyone going to northstar.tf/wiki to the wiki
	fastify.get( "/wiki",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			reply.redirect( "https://r2northstar.gitbook.io/" )
		} )

	// GET /wiki
	// redirect anyone going to northstar.tf/wiki to the wiki
	fastify.get( "/thunderstore",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			reply.redirect( "https://northstar.thunderstore.io/" )
		} )

	done()
}
