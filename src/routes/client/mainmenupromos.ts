import { type FastifyPluginCallback } from "fastify"

const path = require( "path" )
const fs = require( "fs" )


let promodataPath = path.join( __dirname, "..", "..", "..", "assets", "mainmenupromodata.json" )

// watch the mainmenupromodata file so we can update it without a masterserver restart
fs.watch( promodataPath, ( curr, prev ) => {
    try
    {
        mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )
        console.log( "updated main menu promo data successfully!" )
    }
    catch ( ex )
    {
        console.log( `encountered error updating main menu promo data: ${ ex }` )
    }

})

let mainMenuPromoData = {}
if ( fs.existsSync( promodataPath ))
    mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )

const register: FastifyPluginCallback = (fastify, opts, done) => {
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

export default register
