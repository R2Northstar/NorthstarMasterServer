// Socket.js is the main WebSocket component
// It handles all inter-server/intra-net communication
// Before it can start syncing, it has to join a network
// This is handled by auth.js

const { handleIncomingMessage } = require( "./messageHandling.js" )
const { instancesReady, getAllKnownInstances, getInstanceById, getInstanceAddress } = require( "./instances.js" )
const { encryptPayload } = require( "./encryption.js" )
const { attemptSyncWithAny, setOwnSyncState } = require( "./syncutil.js" )
const { getInstanceToken, addNetworkNode, removeNetworkNode, getNetworkNodes, hasNetworkNode, generateToken } = require( "./network.js" )
const accounts = require( "../shared/accounts.js" )
const { logger, logSync } = require("../logging.js")

const isOnline = require( "is-online" )

const { WebSocket, WebSocketServer } = require( "ws" )
let instanceSockets = {}

var timeoutCycles = 50
var checkDelay = 10

// Each node has a WebSocketServer so that it can accept new connections.
// When a new node joins the network, it connects to all other nodes
// Since websockets are full-duplex, that node doesnt need to connect back
// TODO: we should really handle dropped connections and server outages
const wss = new WebSocketServer( { noServer: true } )
logger.info( "Created WebSocket server on port " + process.env.LISTEN_PORT.toString() )
logger.info( "Self-registering with ID " + process.env.DATASYNC_OWN_ID )

// This is the server handling incoming connections and messages
wss.on( "connection", async function connection( ws )
{
	ws.everOpen = true
	let instance = await getInstanceById( ws.id )
	logger.info( "Incoming connection from " + instance.id )
	logger.info( "Updated network! Current network: " + Object.keys( await getNetworkNodes() ) )
	try
	{
		logger.info( "WebSocket connection opened from " + instance.name )
		if( !instanceSockets[ws.id] ) instanceSockets[ws.id] = ws
	}
	catch ( e )
	{
		logger.info( "WebSocket connection opened from unknown instance" )
	}

	ws.on( "message", function message( data )
	{
		handleIncomingMessage( data, ws )
	} )
	ws.on( "close", () =>
	{
		if( ws.everOpen ) logger.warn( "WebSocket connection to " + instance.name + " closed" )
		delete instanceSockets[instance.id]
		removeNetworkNode( instance.id )
	} )
	ws.on( "error", ( err ) =>
	{
		if( err.code == "ECONNREFUSED" ) logger.warn( "WebSocket connection refused by " + instance.name )
		else logger.error( err )
	} )
} )

async function start( server )
{
	return new Promise( resolve =>
	{
		server.on( "upgrade", async function upgrade( request, socket, head )
		{
			const reqUrl = new URL( "http://localhost"+request.url ) // jank solution but it works as all we need to do is get query params
			let instance = getInstanceById( reqUrl.searchParams.get( "id" ) )
			if( !instance )
			{
				logger.warn( "WebSocket attempt refused for unknown instance" )
				return socket.destroy()
			}
			let instanceIp = await getInstanceAddress( instance )
			let realIp = process.env.TRUST_PROXY ? request.headers["x-forwarded-for"] : request.socket.remoteAddress

			let isAuthorized = realIp == instanceIp && !instanceSockets[reqUrl.searchParams.get( "id" )]
			if ( reqUrl.pathname === "/sync" && isAuthorized )
			{
				wss.handleUpgrade( request, socket, head, async function done( ws )
				{
					ws.id = reqUrl.searchParams.get( "id" )
					if( !instanceSockets[instance.id] ) instanceSockets[instance.id] = ws
					wss.emit( "connection", ws, request )
				} )
			}
			else
			{
				logger.warn( "WebSocket attempt refused for " + request.socket.remoteAddress + " acting as " + instance.name )
				socket.destroy()
			}
		} )

		initializeServer()

		resolve()
	} )
}


// Check state of websocket until timeout
async function checkValue( ws, resolve )
{
	for ( let i = 0; i < timeoutCycles; i++ )
	{
		await new Promise( res => setTimeout( res, checkDelay ) )
		if ( ws.readyState != 0 )
		{
			break
		}
	}
	resolve()
}

async function initializeAsNewNetwork()
{
	// Could not find another active server, starting new network
	logger.info( "Unable to find active server from instances. Creating new network" )
	setOwnSyncState( 2 )
	addNetworkNode( process.env.DATASYNC_OWN_ID, generateToken() )

	// backup server every n minutes in case of oopsie
	logger.info( `Will attempt to backup DB every ${process.env.DB_BACKUP_MINUTES || 30} minutes` )
	setInterval( () =>
	{
		accounts.BackupDatabase()
	}, ( process.env.DB_BACKUP_MINUTES || 30 )*60000 )
}

// When the master server is initiated, this function is called
// It loops through all nodes in instances.json and tries to connect to one of them
// If it finds one, it starts the initiation process
// If it cant, it assumes it is the first node of the network and creates a new network
async function initializeServer()
{
	await new Promise( res => instancesReady( res ) )

	let initClient = undefined
	for ( let instance of await getAllKnownInstances() )
	{
		if ( instance.id != process.env.DATASYNC_OWN_ID )
		{
			// Wait for the client to connect using async/await
			logger.info( "Testing connection to " + instance.id )
			initClient = await connectTo( instance )
			await new Promise( res => checkValue( initClient, res ) )
			if ( initClient.readyState == 1 )
			{ // Found a working instance
				break
			}
		}
	}
	if ( initClient && initClient.readyState == 1 )
	{
		logger.info( "Found working instance " + initClient.id )
		let epayload = { method: "auth", payload: { event:"serverRequestJoin", id:process.env.DATASYNC_OWN_ID }}
		initClient.send( JSON.stringify( epayload ) )
	}
	else
	{
		if( await isOnline() ) initializeAsNewNetwork()
	}
}

// A fairly simple wrapper function that takes in an instance object and returns a websocket connection
function connectTo( instance )
{
	const ws = new WebSocket( ( instance.secure ? "wss://" : "ws://" )+instance.host+":"+instance.port+"/sync?id="+process.env.DATASYNC_OWN_ID, {handshakeTimeout: 200} )
	ws.everOpen = false
	ws.id = instance.id
	instanceSockets[instance.id] = ws
	ws.on( "open", async function open()
	{
		ws.everOpen = true
		logger.info( "Opened WebSocket connection to " + instance.name )
	} )
	ws.on( "message", function message( data )
	{
		handleIncomingMessage( data, ws )
	} )
	ws.on( "close", () =>
	{
		if( ws.everOpen ) logger.warn( "WebSocket connection to " + instance.name + " closed" )
		delete instanceSockets[instance.id]
		removeNetworkNode( instance.id )
	} )
	ws.on( "error", ( err ) =>
	{
		if( err.code == "ECONNREFUSED" ) logger.warn( "WebSocket connection refused by " + instance.name )
		else
		{
			logger.error( "WebSocket connection to " + instance.name + " failed" )
			if( process.env.USE_DATASYNC_LOGGING ) logger.error( err )
		}
	} )
	return ws
}

// Because of dependency reasons, the message handlers cannot call functions from socket.js directly
// Instead, we use the workaround of event listeners to make sure this can still happen
async function broadcastEvent( event, payload )
{
	logSync("Broadcasting message to all sockets with event " + event)
	for ( const [id, ws] of Object.entries( instanceSockets ) )
	{
		if ( ws.readyState === WebSocket.OPEN )
		{
			if( hasNetworkNode( id ) )
				ws.send( JSON.stringify( { method: "sync", payload: await encryptPayload( { event, payload }, await getInstanceToken( id ) ) } ) )
		}
	}
}

const broadcastEmitter = require( "./broadcast.js" ).emitter

// The generic function for sending out events to the whole network
broadcastEmitter.addListener( "event", ( data ) =>
{
	broadcastEvent( data.event, data.payload )
} )
broadcastEmitter.addListener( "startSync", async () =>
{
	attemptSyncWithAny( instanceSockets )
} )
// When a new node joins, it needs to connect to all nodes in the network
// Since this is done from a message handler in auth.js, we use this eventlistener
broadcastEmitter.addListener( "connectTo", ( instance ) =>
{
	return connectTo( instance )
} )
module.exports = {
	start,
	broadcastEvent
}
