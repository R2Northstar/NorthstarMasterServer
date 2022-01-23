
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
		logger: process.env.USE_FASTIFY_LOGGER || false,
		https: {
			key: fs.readFileSync( process.env.SSL_KEY_PATH ),
			cert: fs.readFileSync( process.env.SSL_CERT_PATH )
		},
		trustProxy: !!(process.env.TRUST_PROXY)
	})
}
else
{
	fastify = fastify({ 
		logger: process.env.USE_FASTIFY_LOGGER || false,
		trustProxy: !!(process.env.TRUST_PROXY)
	})
}

const ROUTE_PATHS = [ "client", "server", "account" ]

if(!!(process.env.USE_RATELIMIT)) {
	fastify.register(require('fastify-rate-limit'),
	{
		global: false,
		errorResponseBuilder: function(req, context) {
			return {
				code: 429,
				error: 'Too Many Requests',
				message: `Request limit reached. You can send ${context.max} requests every ${context.after}. Timeout expiry: ${context.ttl}ms.`,
				date: Date.now(),
				expiresIn: context.ttl // milliseconds
			}
		}
	}
	);
}

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