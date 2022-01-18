const path = require( "path" )
const fs = require( "fs" )
const { logMonarch } = require("../logging.js")

let promodataPath = path.join( __dirname, "mainmenupromodata.json" )

// watch the mainmenupromodata file so we can update it without a masterserver restart
fs.watch( promodataPath, ( curr, prev ) => {
    try 
    {
        mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )
        logMonarch( "updated main menu promo data successfully!" )
    }
    catch ( ex )
    {
        logMonarch( `encountered error updating main menu promo data: ${ ex }` )
    }

})

let mainMenuPromoData = {}
if ( fs.existsSync( promodataPath ))
    mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )

module.exports = ( fastify, opts, done ) => {
	// exported routes
	
    // GET /client/mainmenupromos
    // returns main menu promo info
    fastify.get( '/client/mainmenupromos', 
    {},
    async ( request, reply ) => {
        return mainMenuPromoData
    })

    done()
}