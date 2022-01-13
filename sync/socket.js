const { getAllKnownInstances, getInstanceById, getInstanceAddress } = require('./util.js');
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
    console.log("Connection from "+ws.id)
    if(!instanceSockets[ws.id]) connectTo(await getInstanceById(ws.id))
    ws.on('message', function message(data) {
      handlePotentialPayload(data)
    });
  
    ws.send('something');
});

function connectTo(instance) {
    const ws = new WebSocket('ws://'+instance.host+':'+instance.port+'/sync?id='+process.env.DATASYNC_OWN_ID);
    ws.everOpen = false;
    instanceSockets[instance.id] = ws;
    ws.on('open', function open() {
        ws.everOpen = true;
        console.log('Opened WebSocket connection to',instance.id)
    });
    ws.on('close', () => {
        if(ws.everOpen) console.log('WebSocket connection to',instance.id,'closed')
        delete instanceSockets[instance.id]
    })
    ws.on('error', (err) => {
        if(err.code == 'ECONNREFUSED') console.log('WebSocket connection refused by',instance.id)
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
                wss.handleUpgrade(request, socket, head, function done(ws) {
                    ws.id = reqUrl.searchParams.get('id')
                    wss.emit('connection', ws, request);
                });
            } else {
                console.log('WebSocket attempt refused for',request.socket.remoteAddress,'acting as',instance.id)
                socket.destroy();
            }
        });
    
        connectToInstances();
        
        resolve()
    })
}

function broadcastData(data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(encryptPayload(data));
        }
    });
}

module.exports = {
    start
}