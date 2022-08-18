const http = require( "http" )
const https = require( "https" )
//const url = require( "url" )

module.exports = {
	request: function request( params, postData = null )
	{
		return new Promise( ( resolve, reject ) =>
		{
			let lib = http
			if ( params.host.startsWith( "https://" ) )
			{
				params.host = params.host.replace( "https://", "" )
				lib = https
			}

			let req = lib.request( params, reqResult =>
			{
				if ( reqResult.statusCode < 200 || reqResult.statusCode >= 300 )
					return reject( {
						statusCode: reqResult.statusCode,
						headers: reqResult.headers
					} )

				let data = []
				reqResult.on( "data", c => data.push( c ) )
				// eslint-disable-next-line
				reqResult.on( "end", _ => resolve( Buffer.concat( data ) ) )
			} )

			req.on( "error", reject )

			if ( postData )
				req.write( postData )

			req.end()
		} )
	}
}
