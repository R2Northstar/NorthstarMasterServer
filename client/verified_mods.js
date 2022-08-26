const path = require( "path" )
const fs = require( "fs" )

// Checks if a mod entry is an object, has "DependencyPrefix" and "Versions" properties,
// and also checks if both fields have correct format.
function checkModEntry ( modContent )
{
	if ( typeof modContent !== "object" || Array.isArray( modContent ) || modContent === null )
		return false
	if ( !Object.prototype.hasOwnProperty.call( modContent, "DependencyPrefix" ) || !Object.prototype.hasOwnProperty.call( modContent, "Versions" ) )
		return false

	// Checking TeamName-ModName format.
	const dependencyPrefix = modContent["DependencyPrefix"]
	if ( !/^[a-zA-Z0-9_]+-[a-zA-Z0-9_]+$/.test( dependencyPrefix ) )
		return false

	// Checking x.y.z versions format.
	const versions = modContent["Versions"]
	for ( const version of versions )
	{
		if ( Object.prototype.toString.call( version ) !== "[object String]" || !/[0-9]+\.[0-9]+\.[0-9]$/.test( version ) )
			return false
	}

	return true
}

// Remove mod entries that do not match formatting convention from exposed mods list.
function checkAllMods()
{
	const mods = Object.keys( verifiedMods )

	for ( let i=0; i<mods.length; i++ )
	{
		const mod = mods[i]
		if ( !checkModEntry( verifiedMods[mod] ) )
		{
			console.warn( `Since "${mod}" does not have correct format, it was removed from verified mods list.` )
			delete verifiedMods[mod]
		}
	}
}

const { getRatelimit } = require( "../shared/ratelimit.js" )
const verifiedModsPath = path.join( __dirname, "resource", "verified_mods.json" )

// watch the JSON file so we can update it without a masterserver restart
fs.watch( verifiedModsPath, () =>
{
	try
	{
		verifiedMods = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )
		checkAllMods()
		console.log( "Updated verified mods list successfully!" )
	}
	catch ( ex )
	{
		console.log( `Encountered error updating verified mods list: ${ ex }` )
	}
} )

let verifiedMods = {}
if ( fs.existsSync( verifiedModsPath ) )
{
	verifiedMods = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )
	checkAllMods()
}

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
			return verifiedMods
		} )

	done()
}
