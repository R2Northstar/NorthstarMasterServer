const path = require( "path" )
const { PLAYER_NOT_FOUND } = require( "../shared/errorcodes.js" )
const { ParseDefinition, PdataToJsonUntyped } = require( "../shared/pjson.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const fs = require( "fs" )
const { translations } = require( path.join( __dirname, "translations.js" ) )

const PLAYER_DATA_PDEF_231 = ParseDefinition( fs.readFileSync( "./persistent_player_data_version_231.pdef", "utf8" ) )

let leaderboardsPath = path.join( __dirname, "leaderboards.json" )
let leaderboards = {}

if ( fs.existsSync( leaderboardsPath ) )
{
	leaderboards = JSON.parse( fs.readFileSync( leaderboardsPath ).toString() )
	let leads = Object.keys( leaderboards )
	console.log( leads )
}

function customSort( leads )
{
	if ( leads !== "mostUsedWeapons" && leads !== "mostKillerWeapons" )
	{
		leaderboards[leads].sort( ( a, b ) =>
		{
			a.value === b.value ? 0 : a.value < b.value ? -1 : 1
		}
		)
	}
	else
	{
		let i = leads === "mostUsedWeapons" ? "time" : "kills"
		leaderboards[leads].sort( ( a, b ) =>
		{
			a.value[i] === b.value[i] ? 0 : a.value[i] < b.value[i] ? -1 : 1
		} )
	}
}

module.exports = ( fastify, opts, done ) =>
{

	fastify.get( "/api/leaderboards",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit

		},
		async () =>
		{
			return leaderboards
		} )
	done()
}
module.exports.updateLeaderboards = async function updateLeaderboards( player )
{

	if ( !player )
	{
		return { success: false, error: PLAYER_NOT_FOUND }
	}
	console.log( "Updating Leaders" )
	let data = PdataToJsonUntyped( player.persistentDataBaseline, PLAYER_DATA_PDEF_231 )
	let wHours = data.weaponStats.map( key => key.hoursUsed )
	let wKills = data.weaponKillStats.map( key => key.total )

	let mostHours = wHours.indexOf( Math.max( ...wHours ) )
	let mostKills = wKills.indexOf( Math.max( ...wKills ) )

	let values = {
		uid: player.id,
		mostKills: data.killStats.total,
		mostTimePlayed: data.timeStats.total,
		bestWinStreak: data.highestWinStreakEver,
		mostDeaths: data.deathStats.total,
		mostUsedWeapons: {
			id: translations.weapons_code[mostHours],
			time: data.weaponStats[mostHours].hoursUsed
		},
		mostKillerWeapons: {
			id: translations.weapons_code[mostKills],
			kills: data.weaponKillStats[mostKills].total
		},
		mostDistanceTraveled: data.distanceStats.total
	}

	console.log( values )

	let leads = Object.keys( leaderboards )
	console.log( leads )

	leads.forEach( e =>
	{
		let uids = leaderboards[e].map( i => i.id )
		if ( uids.includes( values.uid ) )
		{
			leaderboards[e][uids.indexOf( values.uid )].value = values[e]

		}
		else
		{
			leaderboards[e].push( {
				id: values.uid,
				value: values[e]
			} )
		}
		customSort( e )
		leaderboards[e] = leaderboards[e].slice( 0, 10 )
	} )
	fs.writeFileSync( leaderboardsPath, JSON.stringify( leaderboards ) )
}
console.log( module.exports )
