const path = require( "path" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) ) 

module.exports = ( fastify, opts, done ) => {	
	fastify.register( require( "fastify-multipart" ) )

	// exported routes
	
	// POST /accounts/write_persistence
	// attempts to write persistent data for a player
	// note: this is entirely insecure atm, at the very least, we should prevent it from being called on servers that the account being written to isn't currently connected to
	fastify.post( '/accounts/write_persistence', 
	{
		schema: {
			querystring: {
				"id": { type: "string" }
			}
		},
	},
	async ( request, response ) => {
		// check if account exists 
		let account = await accounts.AsyncGetPlayerByID( request.query.id )
		if ( !account )
			return null
		
		// mostly temp
		let buf = await ( await request.file() ).toBuffer() 
		
		if ( buf.length == account.persistentDataBaseline.length )
			await accounts.AsyncWritePlayerPersistenceBaseline( request.query.id, buf )
		
		return null
	})
	
	done()
}