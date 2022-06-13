const { getRatelimit } = require( "../shared/ratelimit" )
const fs = require( "fs" )
const path = require( "path" )
const fastifyStatic = require( "fastify-static" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// add static routes
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "landing/assets" ),
		prefix: "/assets/"
	} )
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "landing/script" ),
		prefix: "/script/",
		decorateReply: false
	} )
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "landing/style" ),
		prefix: "/style/",
		decorateReply: false
	} )

	// GET /
	// display landing page
	fastify.get( "/",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			const stream = fs.createReadStream( path.join( __dirname, "landing/index.html" ), "utf-8" )
			reply.type( "text/html" ).send( stream )
		} )

	done()
}
