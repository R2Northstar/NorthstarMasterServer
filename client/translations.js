const path = require( "path" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const { default: fastify } = require("fastify")

let translationsPath = path.join( __dirname, "translations.json" )

let translations = {}

if ( fs.existsSync( translationsPath ) )
{
	translations = JSON.parse( fs.readFileSync( translationsPath ).toString() )
	let keys = Object.keys( translations )

	keys.forEach( k=>
	{
		let kcode = k+"_code"
		let kname = k+"_name"
		translations[kcode] = Object.keys( translations[k] )
		translations[kname] =  Object.values( translations[k] )
	} )
	console.log( keys )

}

module.exports = (fastify, opts, done) => {
    fastify.get( "/api/translations",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit

		},
		async ( ) =>
		{
			//let n = Object.fromEntries(translations.weapons_code.map( (key, index) => [key, translations.weapons_name[index]]))
			return translations
		} )
    done();
}