const Filter = require( "bad-words" )
const fs = require( "fs" )

let bannedwords = new Filter()

try
{
	const data = fs.readFileSync( "badwords.txt", "UTF-8" )
	const lines = data.split( /\r?\n/ )
	lines.forEach( ( line ) =>
	{
		bannedwords.addWords( line )
	} )
}
catch ( err )
{
	console.error( err )
}

module.exports = {
	bannedwords
}
