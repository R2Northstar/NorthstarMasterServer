// MessageHandling.js is a utility file that takes in a message and routes it to the correct handler

const { getOwnToken, getInstanceToken, hasNetworkNode } = require('./network.js');
const { getOwnSyncState } = require('./syncutil.js');
const { encryptPayload, decryptPayload } = require('./encryption.js');

const dataSync = require('./sync.js');
const dataShare = require('./share.js');
const dataAuth = require('./auth.js');

const crypto = require('crypto');

const { WebSocket } = require('ws');

// The Join Request Buffer is a rolling buffer that holds secrets pertaining to the authentication process
// During the authentication process, a secret is generated every time a node attempts to join the network
const timer = ms => new Promise( res => setTimeout(res, ms));
class JoinRequestBuffer {
    constructor() {
        this.buffer = {}
    }
    generateSecret(id) {
        var secret = crypto.randomBytes(64).toString("hex") // Generate a random secret
        this.buffer[id] = secret
        timer(60000).then(()=>delete this.buffer[id]); // Make sure requests expire after 60s
        return secret
    }
    checkSecret(response, id) {
        return response === this.buffer[id]
    }
}
let joinBuffer = new JoinRequestBuffer()

async function handlePotentialPayload(body, ws) {
    let { token, data, timestamp } = await decryptPayload(body)
    const replyFunc = async (event, json) => {
        if (ws.readyState === WebSocket.OPEN) {
            let token = await getInstanceToken(ws.id);
            let encrypted = await encryptPayload({ event, payload: json }, token)
            ws.send(JSON.stringify({ method: 'sync', payload: encrypted }));
        }
    }
    if(token == await getOwnToken()) {
        // Is valid payload, act upon it
        if(dataSync.hasOwnProperty(data.event)) {
            // If it is a dataSync function run it 
            dataSync[data.event]({ timestamp, payload: data.payload }, replyFunc, ws);
        } else if(dataShare.hasOwnProperty(data.event) && getOwnSyncState() == 2) {
            // If it is a dataShare function run it
            dataShare[data.event]({ timestamp, payload: data.payload }, replyFunc, ws);
        }
        // If it is neither, ignore it
    }
}

async function handleAuthMessage(body, ws) {
    let { event, data } = body
    const replyFunc = async (event, json) => {
        if (ws.readyState === WebSocket.OPEN) {
            // let instance = await getInstanceById(ws.id)
            ws.send(JSON.stringify({ method: "auth", payload: { event, data: json }}));
        }
    }
    if(dataAuth.hasOwnProperty(event)) {
        dataAuth[event]({ data:data, id:ws.id, buffer: joinBuffer}, replyFunc, ws);
    }
}

async function handleIncomingMessage(data, ws) {
    var msg = JSON.parse(data)
    if (msg.method == "auth") {
        handleAuthMessage(msg.payload, ws)
    }
    else {
        if(hasNetworkNode(process.env.DATASYNC_OWN_ID)) handlePotentialPayload(msg.payload, ws)
    }
}

module.exports = {
    handlePotentialPayload,
    handleAuthMessage,
    handleIncomingMessage
}