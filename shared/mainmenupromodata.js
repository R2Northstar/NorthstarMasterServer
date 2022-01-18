const { logMonarch } = require("../logging.js")

const asyncHttp = require("../shared/asynchttp.js") 
async function getRemotePromos(url) {
    try {
        logMonarch('Attempting to fetch remote mainmenupromodata file');
        url = new URL(url)
        let resBuffer = await asyncHttp.request({
            method: "GET",
            host: (url.protocol == "https:" ? "https://" : "")+url.hostname,
            port: url.port,
            path: url.pathname
        })
        let proposed = JSON.parse(resBuffer.toString());
        logMonarch('Remote mainmenupromodata found, saving');
        mainMenuPromoData = proposed;
    } catch(e) {
        logMonarch(`encountered error updating main menu promo data: ${ e }`)
    }
}

const fs = require('fs')
const path = require('path')

let promodataPath = path.join(__dirname,'..','client/mainmenupromodata.json')
let mainMenuPromoData = {}

if ( fs.existsSync( promodataPath ))
    mainMenuPromoData = JSON.parse( fs.readFileSync( promodataPath ).toString() )

if(process.env.PROMOS_REMOTE) {
    getRemotePromos(process.env.PROMOS_REMOTE)
} else {
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
}

module.exports = {
    getPromos: () => {
        return mainMenuPromoData;
    }
}
