const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const path = require( "path" )
const fastifyStatic = require( "fastify-static" )
const showdown  = require( "showdown" )
const converter = new showdown.Converter()

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// Dynamic blog posts
	fastify.get( "/blog/:post",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			const { post } = request.params

			const postData = readPost( post )

			if ( postData )
			{
				reply.type( "text/html" ).send( postData )
			}
			reply.code( 404 ).send( { error: "Not Found", message: `Route GET:/blog/${post} not found`, statusCode: 404 } )

		}
	)

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

const readPost = ( post ) =>
{
	const blogdir = path.join( __dirname, "../web/blog/" )
	const head = fs.readFileSync( blogdir+"blog-head.html", "utf-8" )
	const foot = fs.readFileSync( blogdir+"blog-footer.html", "utf-8" )

	if ( !fs.existsSync( `${blogdir + post}.md` ) )
	{
		return false
	}

	// Get markdown file
	let fileData = fs.readFileSync( `${blogdir+post}.md`, "utf-8" )
	let html = converter.makeHtml( fileData )

	return `${head}\n${html}\n${foot}`

}
