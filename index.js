
if ( process.argv.includes( "-devenv" ) )
	require( 'dotenv' ).config({ path: "./dev.env" })
else
	require( 'dotenv' ).config()
	
const fs = require( "fs" )
const path = require( "path" )

let fastify = require( "fastify" )
if ( process.env.USE_HTTPS )
{
	fastify = fastify({ 
		trustProxy: true,
		logger: process.env.USE_FASTIFY_LOGGER || false,
		https: {
			key: fs.readFileSync( process.env.SSL_KEY_PATH ),
			cert: fs.readFileSync( process.env.SSL_CERT_PATH )
		}
	})
}
else
{
	fastify = fastify({ 
		trustProxy: true,
		logger: process.env.USE_FASTIFY_LOGGER || false,
	})
}

const ROUTE_PATHS = [ "client", "server", "account" ]

for ( let routePath of ROUTE_PATHS )
{
	for ( let file of fs.readdirSync( routePath ) )
	{
		if ( file.endsWith( ".js" ) )
		{
			console.log( `Registering routes from file ${path.join( routePath, file )}` )
			fastify.register( require( path.join( __dirname, routePath, file ) ) )
		}
	}
}

async function start() 
{
	try 
	{
		await fastify.listen( process.env.LISTEN_PORT || 80, process.env.LISTEN_IP || "0.0.0.0" )
	} 
	catch ( ex )
	{
		console.error( ex )
		process.exit( 1 )
	}
}

start()