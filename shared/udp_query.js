const rSrcClient = require( "./a2s_challenge_query" )

const encryptionKey = "WDNWLmJYQ2ZlM0VoTid3Yg==" // standard r2 encryption key

function QueryServerPort( ip, port )
{
	return new Promise( resolve =>
	{
		const client = new rSrcClient( {
			encryptionKey,
			ip,
			port,
			uid: 1000000001337n,
		} )

		let queryTimeout = setTimeout( () =>
		{
			resolve( false ) // return false on timeout reached
		}, 1000 )

		client.on( "challenge", async () =>
		{
			clearTimeout( queryTimeout )
			resolve( true ) // return true on challenge response
		} )

		client.connect() // attempt to connect to the game server
	} )
}

module.exports = {
	QueryServerPort
}
