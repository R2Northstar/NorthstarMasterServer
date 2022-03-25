const versionRe = /(?:^R2Northstar\/)(\d+)\.(\d+)\.(\d+)/g

function minimumVersion( request )
{
	let v = versionRe.exec( request.headers["User-Agent"] )
	if( !process.env.MINIMUM_LAUNCHER_VERSION || request.headers["User-Agent"].match ( /(\+dev)/ ) ) return true
	let minV = process.env.MINIMUM_LAUNCHER_VERSION.split( "." )
	if( v &&  v[1] >= minV[0] && v[2] >= minV[1] && v[3] >= minV[2] ) return true
	return false
}

module.exports = {
	minimumVersion
}
