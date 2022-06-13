const path = require( "path" )
const fs = require( "fs" )

const { getRatelimit } = require( "../shared/ratelimit" )
const { getLastUpdated, getServerList, updateServerList } = require( "../shared/serverlist" )

// Promo data
let promodataPath = path.join( __dirname, "data/mainmenupromodata.json" )

// watch the mainmenupromodata file so we can update it without a masterserver restart
// eslint-disable-next-line
fs.watch( promodataPath, ( curr, prev ) =>
{
	try
	{
		mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath, "utf8" ) )
		console.log( "updated main menu promo data successfully!" )
	}
	catch ( ex )
	{
		console.log( `encountered error updating main menu promo data: ${ ex }` )
	}

} )

let mainMenuPromoData = {}
if ( fs.existsSync( promodataPath ) )
	mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath, "utf8" ) )

// Announcements
let announcementsPath = path.join( __dirname, "data/announcements.json" )

// watch the announcements file so we can update it without a masterserver restart
// eslint-disable-next-line
fs.watch( announcementsPath, ( curr, prev ) =>
{
	try
	{
		announcementsData = JSON.parse( fs.readFileSync( announcementsPath, "utf8" ) )
		console.log( "updated announcements data successfully!" )
	}
	catch ( ex )
	{
		console.log( `encountered error updating announcements data: ${ ex }` )
	}

} )

let announcementsData = {}
if ( fs.existsSync( announcementsPath ) )
	announcementsData = JSON.parse( fs.readFileSync( announcementsPath, "utf8" ) )


// MOTD
let motdPath = path.join( __dirname, "data/motd.txt" )

// watch the announcements file so we can update it without a masterserver restart
// eslint-disable-next-line
fs.watch( motdPath, ( curr, prev ) =>
{
	try
	{
		motdData = fs.readFileSync( motdPath, "utf8" )
		console.log( "updated motd data successfully!" )
	}
	catch ( ex )
	{
		console.log( `encountered error updating motd data: ${ ex }` )
	}

} )

let motdData = ""
if ( fs.existsSync( motdPath ) )
	motdData = fs.readFileSync( motdPath, "utf8" )

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

	// GET /client/motd
	// returns motd
	fastify.get ( "/client/motd",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__CLIENT_MOTD" ) }, // ratelimit
		},
		async ( ) =>
		{
			return motdData
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
