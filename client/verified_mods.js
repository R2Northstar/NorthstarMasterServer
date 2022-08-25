const path = require( "path" )
const fs = require( "fs" )

// Checks if a mod entry respects the mod naming convention (AuthorName-ModName-Version).
// https://northstar.thunderstore.io/package/create/docs/ (check dependencies format)
function checkModEntry (modName) {
	return /^[a-zA-Z0-9\_]+-[a-zA-Z0-9\_]+-[0-9]+\.[0-9]+\.[0-9]+$/.test(modName);
}

// Remove mod entries that do not match naming convention from exposed mods list.
function checkAllMods() {
	for (let i=0; i<verifiedModsList.length; i++) {
	// for (const mod of verifiedModsList) {
		const mod = verifiedModsList[i];

		if (!checkModEntry(mod)) {
			console.warn(`Since "${mod}" does not respect mod naming convention, it was removed from verified mods list.`);
			let index = verifiedModsList.indexOf(mod);
			while (index !== -1) {
				verifiedModsList.splice(index, 1);
				index = verifiedModsList.indexOf(mod);
				i -= 1;
			}
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
		verifiedModsList = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )
		checkAllMods()
		console.log( "Updated verified mods list successfully!" )
	}
	catch ( ex )
	{
		console.log( `Encountered error updating verified mods list: ${ ex }` )
	}
} )

let verifiedModsList = []
if ( fs.existsSync( verifiedModsPath ) ) {
	verifiedModsList = JSON.parse( fs.readFileSync( verifiedModsPath ).toString() )
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
			return verifiedModsList
		} )

	done()
}
