const versionRe = /(?:^R2Northstar\/)(\d+)\.(\d+)\.(\d+)(\+dev)?/g

function minimumVersion( request )
{
	let v = versionRe.exec( request.headers["User-Agent"] )
	if( !process.env.MINIMUM_LAUNCHER_VERSION ) return true
	let minV = process.env.MINIMUM_LAUNCHER_VERSION.split( "." )
	if( v &&  v[1] >= minV[0] && v[2] >= minV[1] && v[3] >= minV[2] || v[4] ) return true
	return false
}

module.exports = {
	minimumVersion
}
