const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const path = require( "path" )
const showdown  = require( "showdown" )
const converter = new showdown.Converter()

// Blog Templates
const blogdir = path.join( __dirname, "../web/blog/" )
const head = fs.readFileSync( blogdir+"blog-head.html", "utf-8" )
const foot = fs.readFileSync( blogdir+"blog-footer.html", "utf-8" )

module.exports = ( fastify, opts, done ) =>
{
	// Preload blog posts
	const postData = getPosts()

	// Blog
	fastify.get( "/blog",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			let posts = ""
			postData.map( ( post, index ) => posts+=`
				<a href="/blog/${post.link}" class="post" style="background-position-y: ${100*index}px">
					<div class="overlay">
						<div class="post-content">
							<div class="link-title">${post.title}</div>
							<div class="link-content">${post.blurb}</div>
						</div>
						<div class="post-read">
							<div class="link-post">Read Post &rsaquo;</div>
						</div>
					</div>
				</a>
			` )
			const stream = `${head}\n${posts}\n${foot}`
			reply.type( "text/html" ).send( stream )
		}
	)

	// Dynamic blog posts
	fastify.get( "/blog/:post",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__LANDING" ) }, // ratelimit
		},
		async ( request, reply ) =>
		{
			const { post } = request.params

			const breadcrumbs = `
				<div class="breadcrumbs">
					<span><a href="/blog">/blog</a>/${post}</span>
				</div>
			`

			if ( !post )
			{
				reply.redirect( "/blog" )
			}

			const postData = readPost( post )

			if ( postData )
			{
				reply.type( "text/html" ).send( `${head}\n${breadcrumbs}\n${postData}\n${foot}` )
			}
			reply.code( 404 ).send( { error: "Not Found", message: `Route GET:/blog/${post} not found`, statusCode: 404 } )

		}
	)

	done()
}

const readPost = ( post ) =>
{
	if ( !fs.existsSync( `${blogdir + post}.md` ) )
	{
		return false
	}

	// Get markdown file
	let fileData = fs.readFileSync( `${blogdir+post}.md`, "utf-8" )
	let html = converter.makeHtml( fileData )

	return html

}

const getPosts = () =>
{
	let allPosts = []
	//passsing directoryPath and callback function
	fs.readdir( blogdir, function ( err, files )
	{
		//handling error
		if ( err )
		{
			return console.log( "Unable to scan directory: " + err )
		}

		//listing all files using forEach
		files.forEach( function ( file )
		{
			if ( file.split( "." )[1]==="md" )
			{
				let data = fs.readFileSync( blogdir+file, "utf-8" )
				let headding = data.match( /(?<=(^#)\s).*/g )
				let paragraph = data.match( /^[A-Za-z].*(?:\n[A-Za-z].*)*/gm )
				allPosts.push( {
					link: file.split( "." )[0],
					title: headding[0],
					blurb: paragraph[0],
				} )
			}
		} )
	} )
	return allPosts
}
