const crypto = require('crypto');

const util = require('util');
const dns = require('dns');
const lookup = util.promisify(dns.lookup);

const { WebSocket } = require('ws');

const fs = require("fs");
let instanceListPath = process.env.INSTANCE_LIST || "./instances.json"
let instances = JSON.parse(fs.readFileSync(instanceListPath, 'utf-8'));

const dataSync = require('./sync.js');
const dataShare = require('./share.js');
const dataAuth = require('./auth.js');

const timer = ms => new Promise( res => setTimeout(res, ms));
class JoinRequestBuffer {
    constructor() {
        this.buffer = {}
    }
    generateSecret(id) {
        var secret = crypto.randomBytes(64).toString("hex") // Generate a random secret
        this.buffer[id] = secret
        timer(60000).then(_=>delete this.buffer[id]); // Make sure requests expire after 60s
        return secret
    }
    checkSecret(response, id) {
        return response === this.buffer[id]
    }
}
joinBuffer = new JoinRequestBuffer()

fs.watch(instanceListPath, (eventType, filename) => {
    try {
        if(eventType == "change") {
            let fileData = fs.readFileSync(instanceListPath, 'utf-8');
            let fileJson = JSON.parse(fileData);
            instances = fileJson;
        }
    } catch(e) {
        console.log(e)
    }
});

// gets a list of instances from the json file
function getAllKnownInstances() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(instances);
        } catch(e) {
            reject(e);
        }
    });
}
// gets a specific instance from the json file
function getInstanceById(id) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(instances.find(inst => inst.id == id));
        } catch(e) {
            reject(e);
        }
    });
}
// gets own instance from the json file based on id env var
function getOwnInstance() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(instances.find(inst => inst.id == process.env.DATASYNC_OWN_ID));
        } catch(e) {
            reject(e);
        }
    });
}
// gets a list of resolved addresses from the hosts in the json file
function getAllKnownAddresses() {
    return new Promise(async (resolve, reject) => {
        try {
            resolve( await Promise.all( instances.map( async instance => (await lookup(instance.host.split("://")[1])).address ) ) );
        } catch(e) {
            reject(e);
        }
    });
}
// gets a resolved addresses for one of the hosts in the json file
function getInstanceAddress(instance) {
    return new Promise(async (resolve, reject) => {
        try {
            resolve( (await lookup(instance.host)).address );
        } catch(e) {
            reject(e);
        }
    });
}

let ownPassword;
// used to verify password of the masterserver remote stuf
function getOwnPassword() {
    return new Promise(async (resolve, reject) => {
        try {
            if(ownPassword) {
                resolve(ownPassword);
            } else {
                let self = instances.find(inst => inst.id == process.env.DATASYNC_OWN_ID);
                ownPassword = self.password;
                resolve(self.password);
            }
        } catch(e) {
            reject(e);
        }
    });
}
// encrypts payloads
async function encryptPayload(body, password) {
    try {
        if(!password) password = await getOwnPassword()

        let timestamp = body.lastModified || Date.now()

        const algorithm = process.env.ENCRYPT_ALGO || "aes-256-cbc"; 

        const initVector = crypto.randomBytes(16);
        const Securitykey = crypto.scryptSync(password, 'salt', 32);
        
        const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
        let encryptedData = cipher.update(JSON.stringify({ password, data: body, timestamp }), "utf-8", "hex");
        encryptedData += cipher.final("hex");

        return { iv: initVector, data: encryptedData.toString() }
    } catch(e) {
        return {} // don't ever error cause i'm nice
    }
}
// decrypts encrypted payloads
async function decryptPayload(body, password) {
    try {
        if(!password) password = await getOwnPassword()

        const encryptedData = body.data;
        const initVector = body.iv;

        const algorithm = process.env.ENCRYPT_ALGO || "aes-256-cbc"; 
        const Securitykey = crypto.scryptSync(password, 'salt', 32);

        const decipher = crypto.createDecipheriv(algorithm, Securitykey, Buffer.from(initVector));
        let decryptedData = decipher.update(encryptedData, "hex", "utf-8");
        decryptedData += decipher.final("utf8");
        let json = JSON.parse(decryptedData);
        return json
    } catch(e) {
        console.log(e)
        return {} // don't ever error cause i'm nice
    }
}

async function handlePotentialPayload(body, ws) {
    let { password, data, timestamp } = await decryptPayload(JSON.parse(body))
    const replyFunc = async (event, json) => {
        if (ws.readyState === WebSocket.OPEN) {
            let instance = await getInstanceById(ws.id)
            ws.send(JSON.stringify(await encryptPayload({ event, data: json }, instance.password)));
        }
    }
    if(password == await getOwnPassword()) {
        // Is valid payload, act upon it
        if(dataSync.hasOwnProperty(data.event)) {
            // If it is a dataSync function run it 
            dataSync[data.event]({ timestamp, payload: data.payload }, replyFunc);
        } else if(dataShare.hasOwnProperty(data.event)) {
            // If it is a dataShare function run it
            dataShare[data.event]({ timestamp, payload: data.payload }, replyFunc);
        }
        // If it is neither, ignore it
    }
}

async function handleAuthMessage(body, ws) {
    let { event, data } = body
    //console.log(event + " " + data)
    const replyFunc = async (event, json) => {
        if (ws.readyState === WebSocket.OPEN) {
            let instance = await getInstanceById(ws.id)
            ws.send(JSON.stringify({ method: "auth", payload: { event, data: json }}));
        }
    }
    if(dataAuth.hasOwnProperty(event)) {
        dataAuth[event]({ data:data, id:ws.id, buffer: joinBuffer}, replyFunc);
    }
}

async function handleIncomingMessage(data, ws) {
    //console.log("Checking if ws is not undefined")
    //console.log(ws)
    //console.log(data.toString())
    var msg = JSON.parse(data)
    //console.log(msg)
    if (msg.method == "auth") {
        handleAuthMessage(msg.payload, ws)
    }
    else {
        handlePotentialPayload(msg.payload, ws)
    }
}

module.exports = {
    getAllKnownInstances,
    getInstanceById,
    getOwnInstance,
    getOwnPassword,
    getInstanceAddress,
    getAllKnownAddresses,
    encryptPayload,
    decryptPayload,
    handlePotentialPayload,
    handleAuthMessage,
    handleIncomingMessage
}