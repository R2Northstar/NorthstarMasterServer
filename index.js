const fastify = require( "fastify" )({ logger: process.argv.includes( "-usefastifylogger" ) })
const fs = require( "fs" )
const path = require( "path" )

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

async function start() {
	try 
	{
		await fastify.listen( 8080, "0.0.0.0" )
	} 
	catch ( ex )
	{
		console.error( ex )
		process.exit( 1 )
	}
}

start()