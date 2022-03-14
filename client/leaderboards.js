const path = require("path")
const { PLAYER_NOT_FOUND } = require( "../shared/errorcodes.js" )
const { ParseDefinition, PdataToJsonUntyped } = require( "../shared/pjson.js" )
const { getRatelimit } = require( "../shared/ratelimit.js" )
const accounts = require( path.join( __dirname, "../shared/accounts.js" ) )
const fs = require( "fs" )
const { default: fastify } = require("fastify")
const { translations } = require(path.join(__dirname, "translations.js"))

const PLAYER_DATA_PDEF_231 = ParseDefinition( fs.readFileSync( "./persistent_player_data_version_231.pdef", "utf8" ) )

let leaderboardsPath = path.join(__dirname, "leaderboards.json");
let leaderboards = {}

if ( fs.existsSync( leaderboardsPath ) )
{
	leaderboards = JSON.parse( fs.readFileSync( leaderboardsPath ).toString() )
    let leads = Object.keys(leaderboards)
    console.log(leads);
}


async function updateLeaderboards( uid ){
	let player = await accounts.AsyncGetPlayerByID(uid);

    if( !player )
		{
			return { success: false, error: PLAYER_NOT_FOUND }
		}

	let data = PdataToJsonUntyped( player.persistentDataBaseline, PLAYER_DATA_PDEF_231);
    let wHours = data.weaponStats.map( key =>key.hoursUsed )
	let wKills = data.weaponKillStats.map( key =>key.total )

    let mostHours =  wHours.indexOf( Math.max( ...wHours ) )
	let mostKills = wKills.indexOf( Math.max( ...wKills ) )

    let values = {
        uid : uid,
        mostKills : data.killStats.total,
        mostTimePlayed : data.timeStats.total,
        bestWinStreak : data.highestWinStreakEver,
        mostDeaths : data.deathStats.total,
        mostUsedWeapons : {
            id : translations.weapons_code[mostHours],
            time: data.weaponStats[mostHours].hoursUsed
        },
        mostKillerWeapons : {
            id : translations.weapons_code[mostKills],
            kills : data.weaponKillStats[mostKills].total
        },
        mostDistanceTraveled : data.distanceStats.total
    }

    console.log(values)
    
    let leads = leaderboards.keys();
    console.log(leads);
    
    leads.forEach((e, index) =>{
        let uids = leaderboards[e].map( i => i.id)
        if( uids.includes( uid ) ){
            leaderboards[e][ uids.indexOf(uid) ].value = values[leads]
            
        }else{
            leaderboards[leads].push({
                id : uid,
                value : values[leads]
            })
        }
        customSort(leads);
        leaderboards[leads] = leaderboards[leads].slice(0, 10)
    })

}

function customSort( leads ){
    if(leads !== "mostUsedWeapons" && leads !== "mostKillerWeapons"){
        leaderboards[leads].sort((a, b)=>
        {
            a.value === b.value ? 0 : a.value < b.value ? -1 : 1
        }
        )
    }else{
        let i = leads === "mostUsedWeapons" ? "time" : "kills"
        leaderboards.sort((a, b) => {
            a.value[i] === b.value[i] ? 0 : a.value[i]< b.value[i] ? -1 : 1
        })
    }
}

module.exports = (fastify, opts, done) => {
    fastify.get( "/api/leaderboards",
		{
			config: { rateLimit: getRatelimit( "REQ_PER_MINUTE__REDIRECT" ) }, // ratelimit

		},
		async ( ) =>
		{
			return leaderboards
		} )
    done();
}