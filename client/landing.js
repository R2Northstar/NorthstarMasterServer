const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const path = require( "path" )
const fastifyStatic = require( "fastify-static" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// security.txt
	fastify.get( "/.well-known/security.txt",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			const stream = fs.createReadStream( path.join( __dirname, "../web/.well-known/security.txt" ), "utf-8" )
			reply.type( "text/plain" ).send( stream )
		} )

	// add static routes
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "../web/assets" ),
		prefix: "/assets/"
	} )
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "../web/script" ),
		prefix: "/script/",
		decorateReply: false
	} )
	fastify.register( fastifyStatic, {
		root: path.join( __dirname, "../web/style" ),
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
			const stream = fs.createReadStream( path.join( __dirname, "../web/index.html" ), "utf-8" )
			reply.type( "text/html" ).send( stream )
		} )

	done()
}
