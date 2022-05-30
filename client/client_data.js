const path = require( "path" )
const fs = require( "fs" )

const { getRatelimit } = require( "../shared/ratelimit" )
const { getLastUpdated, getServerList, updateServerList } = require( "../shared/serverlist" )

let promodataPath = path.join( __dirname, "mainmenupromodata.json" )

// watch the mainmenupromodata file so we can update it without a masterserver restart
// eslint-disable-next-line
fs.watch( promodataPath, ( curr, prev ) =>
{
	try
	{
		mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )
		console.log( "updated main menu promo data successfully!" )
	}
	catch ( ex )
	{
		console.log( `encountered error updating main menu promo data: ${ ex }` )
	}

} )

let mainMenuPromoData = {}
if ( fs.existsSync( promodataPath ) )
	mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )


let announcementsPath = path.join( __dirname, "announcements.json" )

// watch the announcements file so we can update it without a masterserver restart
// eslint-disable-next-line
fs.watch( announcementsPath, ( curr, prev ) =>
{
	try
	{
		announcementsData = JSON.parse( fs.readFileSync( announcementsPath ).toString() )
		console.log( "updated main menu promo data successfully!" )
	}
	catch ( ex )
	{
		console.log( `encountered error updating main menu promo data: ${ ex }` )
	}

} )

let announcementsData = {}
if ( fs.existsSync( announcementsPath ) )
	announcementsData = JSON.parse( fs.readFileSync( announcementsPath ).toString() )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /client/mainmenupromos
	// returns main menu promo info
	fastify.get( "/client/mainmenupromos",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_MAINMENUPROMOS" ) }, // ratelimit
		},
		async ( ) =>
		{
			return mainMenuPromoData
		} )

	// GET /client/announcements
	// returns global announcements
	fastify.get ( "/client/announcements",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_ANNOUNCEMENTS" ) }, // ratelimit
		},
		async ( ) =>
		{
			return announcementsData
		} )

	// GET /client/servers
	// returns a list of available servers
	fastify.get( "/client/servers",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_SERVERS" ) }, // ratelimit
		},
		async ( ) =>
		{
			if ( Date.now() > getLastUpdated() + 1000 )
			{
				updateServerList()
			}

			return getServerList()
		} )

	done()
}
