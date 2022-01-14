const { getAllKnownInstances, getInstanceById, getInstanceAddress, encryptPayload, handlePotentialPayload } = require('./util.js');
const { WebSocket, WebSocketServer } = require('ws');
let instanceSockets = {}
let instanceClients = {}

async function connectToInstances() {
    let instances = await getAllKnownInstances();
    for (const instance of instances) {
        if(instance.id != process.env.DATASYNC_OWN_ID) {
            connectTo(instance)
        }
    }
}

const wss = new WebSocketServer({ noServer: true });
console.log("Created WebSocket server")

wss.on('connection', async function connection(ws) {
    ws.everOpen = true;
    let instance = await getInstanceById(ws.id)
    console.log("WebSocket connection opened from "+instance.name)
    // if(!instanceSockets[ws.id]) connectTo(instance)
    if(!instanceSockets[ws.id]) instanceSockets[instance.id] = ws;
    ws.on('message', function message(data) {
        handlePotentialPayload(data)
    });
    ws.on('close', () => {
        if(ws.everOpen) console.log('WebSocket connection to',instance.name,'closed')
        delete instanceSockets[instance.id]
    })
    ws.on('error', (err) => {
        if(err.code == 'ECONNREFUSED') console.log('WebSocket connection refused by',instance.name)
        else console.log(err)
    })
});

function connectTo(instance) {
    const ws = new WebSocket('ws://'+instance.host+':'+instance.port+'/sync?id='+process.env.DATASYNC_OWN_ID);
    ws.everOpen = false;
    instanceSockets[instance.id] = ws;
    ws.on('open', async function open() {
        ws.everOpen = true;
        console.log('Opened WebSocket connection to',instance.name)
    });
    ws.on('message', function message(data) {
        handlePotentialPayload(data, instanceSockets[instance.id])
    });
    ws.on('close', () => {
        if(ws.everOpen) console.log('WebSocket connection to',instance.name,'closed')
        delete instanceSockets[instance.id]
    })
    ws.on('error', (err) => {
        if(err.code == 'ECONNREFUSED') console.log('WebSocket connection refused by',instance.name)
        else console.log(err)
    })
}

async function start(server) {
    return new Promise((resolve, reject) => {
        server.on('upgrade', async function upgrade(request, socket, head) {
            const reqUrl = new URL('http://localhost'+request.url);
            let instance = await getInstanceById(reqUrl.searchParams.get('id'))
            let instanceIp = await getInstanceAddress(instance);
            let isAuthorized = request.socket.remoteAddress == instanceIp && !instanceClients[reqUrl.searchParams.get('id')];
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
    
        connectToInstances();
        
        resolve()
    })
}

async function broadcastEvent(event, payload) {
    wss.clients.forEach(async function each(ws) {
        if (ws.readyState === WebSocket.OPEN) {
            let instance = await getInstanceById(ws.id)
            ws.send(JSON.stringify(await encryptPayload({ event, payload }, instance.password)));
        }
    });
}

const broadcastEmitter = require('./broadcast.js').emitter
broadcastEmitter.addListener('event', (data) => {
    broadcastEvent(data.event, data.payload);
})

module.exports = {
    start,
    broadcastEvent
}