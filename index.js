// This is some code for handling the command line arguments
// This is just to overwrite .env when debugging
const args = require( "minimist" )( process.argv.slice( 2 ) )
require( "dotenv" ).config( { path: "./"+( args.env || ( args.devenv ? "dev.env" : ".env" ) ) } )
if(process.env.SYNC_LOGGING_LEVEL == undefined) process.env.SYNC_LOGGING_LEVEL  = 1
const { logMonarch } = require("./logging.js")

const fs = require( "fs" )
const path = require( "path" )

let fastify = require( "fastify" )
if ( process.env.USE_HTTPS )
{
	fastify = fastify( {
		logger: process.env.USE_FASTIFY_LOGGER || false,
		https: {
			key: fs.readFileSync( process.env.SSL_KEY_PATH ),
			cert: fs.readFileSync( process.env.SSL_CERT_PATH )
		},
		trustProxy: !!( process.env.TRUST_PROXY )
	} )
}
else
{
	fastify = fastify( {
		logger: process.env.USE_FASTIFY_LOGGER || false,
		trustProxy: !!( process.env.TRUST_PROXY )
	} )
}

const ROUTE_PATHS = [ "client", "server", "account" ]

for ( let routePath of ROUTE_PATHS )
{
	for ( let file of fs.readdirSync( routePath ) )
	{
		if ( file.endsWith( ".js" ) )
		{
			logMonarch( `Registering routes from file ${path.join( routePath, file )}` )
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

// ensure completion of data with instances before listening for http requests
if( process.env.USE_INSTANCING == "1" || process.env.USE_INSTANCING == "true" )
{
	const syncing = require( "./sync/socket.js" )
	syncing.start( fastify.server ).then( () =>
	{
		start()
	} )
}
else
{
	start()
}
