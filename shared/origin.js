let sidCookie
let AuthToken
let authed = false
const fs = require( "fs" )
const https = require( "https" )
const { parseString } = require( "xml2js" )

async function authWithOrigin()
{ // thanks to r-ex for the help
	const fidURL = "https://accounts.ea.com/connect/auth?response_type=code&client_id=ORIGIN_SPA_ID&display=originXWeb/login&locale=en_US&release_type=prod&redirect_uri=https://www.origin.com/views/login.html"
	const loginURL = "https://accounts.ea.com/connect/auth?client_id=ORIGIN_JS_SDK&response_type=token&redirect_uri=nucleus:rest&prompt=none&release_type=prod"

	if( !sidCookie )
	{
		let fidLocation = ( await GetHeaders( fidURL ) )["location"]
		// let fid = fidLocation.match(/(?<=fid=)[a-zA-Z0-9]+?(?=&|$)/g)[0];
		let jSessionIDheaders = await GetHeaders( fidLocation )
		let jSessionID = jSessionIDheaders["set-cookie"].join( "; " ).match( /(?<=JSESSIONID=)[\S]+?(?=;)/g )[0]
		let signinCookie = jSessionIDheaders["set-cookie"].join( "; " ).match( /(?<=signin-cookie=)[\S]+?(?=;)/g )[0]
		let jSessionLocation = `https://signin.ea.com${jSessionIDheaders["location"]}`

		// AuthorizeLogin
		let authData = {
			"email": process.env.ORIGIN_EMAIL,
			"password": process.env.ORIGIN_PASSWORD,
			"_eventId": "submit",
			"cid": GenerateCID(),
			"showAgeUp": "true",
			"thirdPartyCaptchaResponse": "",
			"_rememberMe": "on",
			"rememberMe": "on"
		}
		let authResponse = await PostData( jSessionLocation, authData, {"Cookie": [`JSESSIONID=${jSessionID}`, `signin-cookie=${signinCookie}`]} )
		let authResLocation = authResponse.toString().match( /(?<=window\.location = ")\S+(?=";)/g )[0]
		let sidHeaders = await GetHeaders( authResLocation, {"Cookie": [`JSESSIONID=${jSessionID}`, `signin-cookie=${signinCookie}`]} )
		sidCookie = sidHeaders["set-cookie"].join( "; " ).match( /(?<=sid=)[\S]+?(?=;)/g )[0]
	}
	let authTokenRes = await GetData( loginURL, {"Cookie": [`sid=${sidCookie}`]} )
	let authResJson = JSON.parse( authTokenRes.toString() )

	if( authResJson.error )
	{
		authed = false
		console.log( `Error authing with Origin: '${authResJson.error}'` )
	}
	else
	{

		AuthToken = authResJson.access_token
		console.log( "Successfully got Origin auth token" )
		authed = true

		if( process.env.ORIGIN_PERSIST_SID )
		{
			fs.writeFile( "./sid.cookie", sidCookie, ( err ) =>
			{
				if( err ) console.log( "Failed to save Origin sid cookie" )
				else console.log( "Saved Origin sid cookie" )
			} )
		}

		setTimeout( authWithOrigin, Number( authResJson.expires_in )*1000 - 60000 ) // Refresh access token 1 minute before it expires just to be safe
	}
}

if( Number( process.env.ORIGIN_ENABLE ) )
{
	console.log( "Attempting to auth with Origin" )
	if( process.env.ORIGIN_PERSIST_SID && fs.existsSync( "./sid.cookie" ) )
	{
		console.log( "Found Origin sid cookie, reading data" )
		sidCookie = fs.readFileSync( "./sid.cookie", "utf-8" ).replace( /\r?\n|\r/g, "" )
	}
	authWithOrigin()
}

function GenerateCID()
{
	var l = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz"
	var h = 32
	var j = ""
	for ( var k = 0; k < h; k++ )
	{
		var m = Math.floor( Math.random() * l.length )
		j += l.substring( m, m + 1 )
	}
	return j
}

function GetHeaders( location, headers = {} )
{
	return new Promise( resolve =>
	{
		let params = { headers }
		let href = new URL( location )
		params.host = href.host
		params.path = href.pathname + href.search
		https.get( params, reqResult =>
		{
			resolve( reqResult.headers )
		} )
	} )
}
function GetData( location, headers = {} )
{
	return new Promise( resolve =>
	{
		let params = { headers }
		let href = new URL( location )
		params.host = href.host
		params.path = href.pathname + href.search
		https.get( params, reqResult =>
		{
			let data = []
			reqResult.on( "data", c => data.push( c ) )
			// eslint-disable-next-line
			reqResult.on( "end", _ => resolve( Buffer.concat( data ) ) )
		} )
	} )
}

// data must be an object to be sent as x-www-form-urlencoded
function PostData( location, postData, headers = {} )
{
	return new Promise( ( resolve, reject ) =>
	{
		let params = { headers }
		let href = new URL( location )
		params.method = "POST"

		params.host = href.host
		params.path = href.pathname + href.search

		if ( postData )
		{
			var body = new URLSearchParams()
			for( var name in postData )
			{
				body.append( name, postData[name] )
			}

			headers["Content-Length"] = body.toString().length
			headers["Content-Type"] = "application/x-www-form-urlencoded"
		}
		let req = https.request( params, reqResult =>
		{
			let data = []
			reqResult.on( "data", c => data.push( c ) )
			// eslint-disable-next-line
			reqResult.on( "end", _ => resolve( Buffer.concat( data ) ) )
		} )

		req.on( "error", e =>
		{
			reject( e )
		} )

		if ( postData )
		{
			req.write( body.toString() )
		}

		req.end()
	} )
}

const asyncHttp = require( "./asynchttp.js" )

async function getUserInfo( uid )
{
	try
	{
		if( !authed || !AuthToken ) return

		let response = await asyncHttp.request( {
			method: "GET",
			host: "https://api1.origin.com",
			port: 443,
			path: `/atom/users?userIds=${uid}`,
			headers: { "AuthToken": AuthToken }
		} )

		let json
		try
		{
			json = await new Promise( resolve =>
			{
				parseString( response.toString(), function ( err, result )
				{
					resolve( result )
				} )
			} )
		}
		catch ( error )
		{
			return
		}
		return json.users.user[0]
	}
	catch ( error )
	{
		return
	}
}

module.exports = {
	getOriginAuthState: function getOriginAuthState()
	{
		return authed
	},
	getUserInfo
}
