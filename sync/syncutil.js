let syncState = 0
function getOwnSyncState()
{
	return syncState
}
function setOwnSyncState( state )
{
	syncState = state
}

let receivedSyncData = false
function setReceivedSyncData( hasReceived )
{
	receivedSyncData = hasReceived
}

var stateTimeoutCycles = 50
var stateCheckDelay = 10

async function getInstanceState( ws, resolve )
{
	for ( let i = 0; i < stateTimeoutCycles; i++ )
	{
		await new Promise( res => setTimeout( res, stateCheckDelay ) )
		if ( ws.syncState != undefined )
		{
			break
		}
	}
	resolve()
}

var syncTimeoutCycles = 50
var syncCheckDelay = 50
async function waitForSyncDataReceived( resolve )
{
	for ( let i = 0; i < syncTimeoutCycles; i++ )
	{
		await new Promise( res => setTimeout( res, syncCheckDelay ) )
		if ( receivedSyncData )
		{
			break
		}
	}
	resolve()
}

const { encryptPayload } = require( "./encryption.js" )
const { getInstanceToken } = require( "./network.js" )
const accounts = require( "../shared/accounts.js" )
const { logSync } = require("../logging.js")

async function attemptSyncWithAny( sockets )
{
	accounts.BackupDatabase() // backup DB on startup in case of big oopsie

	logSync( "Attempting to sync with first available server", 2 )
	setOwnSyncState( 1 )
	// Attempt to sync with any up-and-running masterserver
	let hasSynced = false

	for( const [id, ws] of Object.entries( sockets ) )
	{
		if( !hasSynced )
		{
			try
			{
				let token = await getInstanceToken( id )
				let encrypted = await encryptPayload( { event: "getState", payload: { } }, token )
				ws.send( JSON.stringify( { method: "sync", payload: encrypted } ) )

				await new Promise( res => getInstanceState( ws, res ) )

				if( ws.syncState == 2 )
				{
					try
					{
						logSync( "Attempting sync with instance "+id , 2)
						// Sync data
						let encrypted = await encryptPayload( { event: "requestSyncData", payload: { } }, token )
						ws.send( JSON.stringify( { method: "sync", payload: encrypted } ) )


						await new Promise( res => waitForSyncDataReceived( res ) )

						if( receivedSyncData )
						{
							logSync( "Completed sync with instance "+id , 2)
							setOwnSyncState( 2 )
							hasSynced = true
						}
						else
						{
							logSync( "No sync data response from "+id+" before timeout", 2, type="warn")
						}
					}
					catch( e )
					{
						logSync( "Failed to complete sync with instance "+id, 2, type="error")
						logSync(e, 1, type="error")
					}
				}
			}
			catch( e )
			{
				logSync(e, 1, type="error")
			}
		}
	}

	// Skip if none available
	if( !hasSynced )
	{
		logSync("Sync could not be completed", 1, type="error")
		setOwnSyncState( 2 )
	}

	// backup server every n minutes in case of oopsie
	logSync( `Will attempt to backup DB every ${process.env.DB_BACKUP_MINUTES || 30} minutes` , 3)
	setInterval( () =>
	{
		accounts.BackupDatabase()
	}, ( process.env.DB_BACKUP_MINUTES || 30 )*60000 )
}

module.exports = {
	getOwnSyncState,
	setOwnSyncState,
	setReceivedSyncData,
	attemptSyncWithAny
}
