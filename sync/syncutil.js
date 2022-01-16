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

async function attemptSyncWithAny( sockets )
{
	accounts.BackupDatabase() // backup DB on startup in case of big oopsie

	console.log( "Attempting to sync with first available server" )
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
						console.log( "Attempting sync with instance "+id )
						// Sync data
						let encrypted = await encryptPayload( { event: "requestSyncData", payload: { } }, token )
						ws.send( JSON.stringify( { method: "sync", payload: encrypted } ) )


						await new Promise( res => waitForSyncDataReceived( res ) )

						if( receivedSyncData )
						{
							console.log( "Completed sync with instance "+id )
							setOwnSyncState( 2 )
							hasSynced = true
						}
						else
						{
							console.log( "No sync data response from "+id+" before timeout" )
						}
					}
					catch( e )
					{
						console.log( e )
						console.log( "Failed to complete sync with instance "+id )
					}
				}
			}
			catch( e )
			{
				console.log( e )
			}
		}
	}

	// Skip if none available
	if( !hasSynced )
	{
		console.log( "Sync could not be completed" )
		setOwnSyncState( 2 )
	}

	// backup server every n minutes in case of oopsie
	console.log( `Will attempt to backup DB every ${process.env.DB_BACKUP_MINUTES || 30} minutes` )
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
