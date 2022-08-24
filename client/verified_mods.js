const path = require( "path" )
const fs = require( "fs" )

const { getRatelimit } = require( "../shared/ratelimit.js" )
const verifiedModsPath = path.join( __dirname, "resource", "verified_mods.json" );

// watch the JSON file so we can update it without a masterserver restart
fs.watch( verifiedModsPath, ( curr, prev ) =>
{
	try
	{
		verifiedModsList = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )
		console.log( "Updated verified mods list successfully!" )
	}
	catch ( ex )
	{
		console.log( `Encountered error updating verified mods list: ${ ex }` )
	}

} )

let verifiedModsList = [];
if ( fs.existsSync( verifiedModsPath ) )
	verifiedModsList = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /client/verifiedmods
	// returns a list of manually-verified mods
	fastify.get( "/client/verifiedmods",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_VERIFIEDMODS" ) }, // ratelimit
		},
		async ( ) =>
		{
			return verifiedModsList
		} )

	done()
}
