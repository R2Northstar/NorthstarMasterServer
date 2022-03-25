const path = require( "path" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )

const { getRatelimit } = require( "../shared/ratelimit.js" )

module.exports = ( fastify, opts, done ) =>
{
	// exported routes

	// GET /accounts/lookup_uid
	// attempts to find the uid of a player with a given username
	fastify.get( "/accounts/lookup_uid",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__ACCOUNT_LOOKUPUID" ) }, // ratelimit
			schema: {
				querystring: {
					"username": { type: "string" }
				}
			},
		},
		async ( request ) =>
		{
			if( !request.query.username )
			{
				return {
					success: false,
					username: "",
					matches: [],
					error: "No username provided"
				}
			}
			let matches = await accounts.AsyncGetPlayersByUsername( request.query.username )
			return {
				success: true,
				username: request.query.username,
				matches: matches.map( m => m.id )
			}
		} )

	// GET /accounts/get_username
	// attempts to find the username of a player with a given uid
	fastify.get( "/accounts/get_username",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__ACCOUNT_GETUSERNAME" ) }, // ratelimit
			schema: {
				querystring: {
					"uid": { type: "string" }
				}
			},
		},
		async ( request ) =>
		{
			if( !request.query.uid )
			{
				return {
					success: false,
					uid: "",
					matches: [],
					error: "No UID provided"
				}
			}
			console.log( request.query.uid )
			let match = await accounts.AsyncGetPlayerByID( request.query.uid )
			if( match == null )
			{
				return {
					success: false,
					uid: request.query.uid,
					matches: [],
					error: "No user found with that UID"
				}
			}
			return {
				success: true,
				uid: request.query.uid,
				matches: [match.username]
			}
		} )

	done()
}
