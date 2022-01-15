// Socket.js is the main WebSocket component
// It handles all inter-server/intra-net communication
// Before it can start syncing, it has to join a network
// This is handled by auth.js

const { getAllKnownInstances, getInstanceById, getInstanceAddress, handleIncomingMessage } = require('./util.js');
const { encryptPayload } = require('./encryption.js');
const { getInstanceToken, removeToken, hasToken, setToken, generateToken } = require('./tokens.js');
const { attemptSyncWithAny, setOwnSyncState, getOwnSyncState } = require('./syncutil.js');

const { WebSocket, WebSocketServer } = require('ws');
let instanceSockets = {}

var timeoutCycles = 50
var checkDelay = 10

async function checkValue(ws, resolve) {
    for (let i = 0; i < timeoutCycles; i++) {
        await new Promise( res => setTimeout(res, checkDelay))
        if (ws.readyState != 0) {
            break
        }
    }
    resolve()
}

async function initializeServer() {
    let initClient = undefined
    for (let instance of await getAllKnownInstances()) {
        if (instance.id == process.env.DATASYNC_OWN_ID) {
            continue
        }
        else {
            // Wait for the client to connect using async/await
            console.log("Testing connection to " + instance.id)
            initClient = await connectTo(instance)
            //await new Promise(resolve => initClient.once('open', resolve));
            await new Promise(res => checkValue(initClient, res))
            if (initClient.readyState == 1) { // Found a working instance
                break
            }
        }
    }
    if (initClient.readyState == 1) {
        //initClient.on('message', msg => handleIncomingMessage(msg, initClient) );
        console.log("Found working instance " + initClient.id)
        let epayload = { method: "auth", payload: { event:"serverRequestJoin", id:process.env.DATASYNC_OWN_ID }}
        initClient.send(JSON.stringify(epayload));
    }
    // Once auth is done, master server should send over list of active servers in network and do symmetric key exchange
}

const wss = new WebSocketServer({ port:process.env.LISTEN_PORT }, id=process.env.DATASYNC_OWN_ID);
console.log("Created WebSocket server on port " + process.env.LISTEN_PORT.toString())
console.log("We are ID " + process.env.DATASYNC_OWN_ID)

// This is the server handling incoming connections and messages
wss.on('connection', async function connection(ws) {
    ws.everOpen = true;
    let instance = await getInstanceById(ws.id)
    try {
        console.log("WebSocket connection opened from "+instance.name)
        if(!instanceSockets[ws.id]) instanceSockets[ws.id] = ws;
    }
    catch (e) {
        console.log("WebSocket connection opened from unknown instance")
    }
    
    ws.on('message', function message(data) {
        handleIncomingMessage(data, ws)
    });
    ws.on('close', () => {
        if(ws.everOpen) console.log('WebSocket connection to',instance.name,'closed')
        delete instanceSockets[instance.id]
        removeToken(instance.id)
    })
    ws.on('error', (err) => {
        if(err.code == 'ECONNREFUSED') console.log('WebSocket connection refused by',instance.name)
        else console.log(err)
    })
});

function connectTo(instance) {
    const ws = new WebSocket('ws://'+instance.host+':'+instance.port+'/sync?id='+process.env.DATASYNC_OWN_ID, {handshakeTimeout: 200});
    ws.everOpen = false;
    ws.id = instance.id;
    instanceSockets[instance.id] = ws;
    ws.on('open', async function open() {
        ws.everOpen = true;
        console.log('Opened WebSocket connection to',instance.name)
    });
    ws.on('message', function message(data) {
        handleIncomingMessage(data, ws)
    });
    ws.on('close', () => {
        if(ws.everOpen) console.log('WebSocket connection to',instance.name,'closed')
        delete instanceSockets[instance.id]
    })
    ws.on('error', (err) => {
        if(err.code == 'ECONNREFUSED') console.log('WebSocket connection refused by',instance.name)
        else console.log(err)
    })
    return ws
}

async function start(server) {
    return new Promise(resolve => {
        server.on('upgrade', async function upgrade(request, socket, head) {
            const reqUrl = new URL('http://localhost'+request.url);
            let instance = await getInstanceById(reqUrl.searchParams.get('id'))
            let instanceIp = await getInstanceAddress(instance);
            let isAuthorized = request.socket.remoteAddress == instanceIp && !instanceSockets[reqUrl.searchParams.get('id')];
            if (reqUrl.pathname === '/sync' && isAuthorized) {
                wss.handleUpgrade(request, socket, head, async function done(ws) {
                    ws.id = reqUrl.searchParams.get('id')
                    wss.emit('connection', ws, request);
                });
            } else {
                console.log('WebSocket attempt refused for',request.socket.remoteAddress,'acting as',instance.name)
                socket.destroy();
            }
        });

        // Need to add proper detection for first server
        if (process.env.LISTEN_PORT != 8080) {
            initializeServer()
        } else {
            setOwnSyncState(2);
            setToken(process.env.DATASYNC_OWN_ID, generateToken());
        }
        
        resolve()
    })
}

async function broadcastEvent(event, payload) {
    for (const [id, ws] of Object.entries(instanceSockets)) {
        if (ws.readyState === WebSocket.OPEN) {
            if(hasToken(id))
                ws.send(JSON.stringify({ method: 'sync', payload: await encryptPayload({ event, payload }, await getInstanceToken(id)) }));
        }
    }
}

const broadcastEmitter = require('./broadcast.js').emitter;

broadcastEmitter.addListener('event', (data) => {
    broadcastEvent(data.event, data.payload);
})
broadcastEmitter.addListener('startSync', async (data) => {
    attemptSyncWithAny(instanceSockets)
})

module.exports = {
    start,
    broadcastEvent
}