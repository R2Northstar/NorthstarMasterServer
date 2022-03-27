const semver = require( "semver" )

function minimumVersion( request )
{
	if( !process.env.MINIMUM_LAUNCHER_VERSION ) return true
	if( !request.headers["user-agent"] || !request.headers["user-agent"].startsWith( "R2Northstar/" ) ) return false
	let v = request.headers["user-agent"].split( " " )[0].substring( 12 )
	return v.match( /\+dev/g ) || semver.valid( v ) && semver.gte( v, process.env.MINIMUM_LAUNCHER_VERSION )
}

module.exports = {
	minimumVersion
}
