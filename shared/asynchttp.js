const http = require( "http" )
//const url = require( "url" )

// could probably convert this to support https too later, effort tho
module.exports = {
	request: function request( params, postData = null ) {
		return new Promise( ( resolve, reject ) => {
			let req = http.request( params, reqResult => {
				if ( reqResult.statusCode < 200 || reqResult.statusCode >= 300) 
					return reject()
				
				let data = []
				reqResult.on( "data", c => data.push( c ) )
				reqResult.on( "end", _ => resolve( Buffer.concat( data ) ) )
			});
			
			req.on( "error", reject )
			
			if ( postData )
				req.write( postData )
				
			req.end()
		})
	}
}