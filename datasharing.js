const fs = require('fs').promises;
const asyncHttp = require("./shared/asynchttp.js") 
const crypto = require("crypto");

// DNS lookup :)
const util = require('util');
const dns = require('dns');
const lookup = util.promisify(dns.lookup);

// 0=Starting, 1=Syncing, 2=Running
let state = 0
let instanceListPath = process.env.INSTANCE_LIST || "./instances.json"

// decrypts encrypted payloads
async function decryptPayload(body, password) {
    try {
        if(!password) password = await getOwnPassword()

        const encryptedData = body.data;
        const initVector = body.iv;

        const algorithm = "aes-256-cbc"; 
        const Securitykey = crypto.scryptSync(password, 'salt', 32);

        const decipher = crypto.createDecipheriv(algorithm, Securitykey, Buffer.from(initVector));
        let decryptedData = decipher.update(encryptedData, "hex", "utf-8");
        decryptedData += decipher.final("utf8");
        let json = JSON.parse(decryptedData);
        return json
    } catch(e) {
        return {} // don't ever error cause i'm nice
    }
}

// used to verify password of the masterserver remote stuf
function getOwnPassword() {
    return new Promise(async (resolve, reject) => {
        try {
            let data = await fs.readFile(instanceListPath);
            let self = JSON.parse(data).find(i => i.isSelf);
            resolve(self.password);
        } catch(e) {
            reject(e);
        }
    });
}

// gets a list of instances from the json file
function getAllKnownInstances() {
    return new Promise(async (resolve, reject) => {
        try {
            let data = await fs.readFile(instanceListPath);
            resolve(JSON.parse(data));
        } catch(e) {
            reject(e);
        }
    });
}
// gets a list of resolved addresses from the hosts in the json file
function getAllKnownAddresses() {
    return new Promise(async (resolve, reject) => {
        try {
            let data = await fs.readFile(instanceListPath);
            resolve( await Promise.all( JSON.parse(data).map( async instance => (await lookup(instance.host.split("://")[1])).address ) ) );
        } catch(e) {
            reject(e);
        }
    });
}

// sends a post req to all instances to attempt data propagation
async function broadcastMessage(endpoint, data) {
    instances = await getAllKnownInstances();
    if(process.env.USE_DATASYNC_LOGGER) console.log(`Sharing '${endpoint}' data with [${instances.map(i => '\"'+i.name+'\"').join(", ")}]`)
    instances.forEach(async instance => {
        if(instance.isSelf) return;

        // console.log(instance.name + " | " + instance.host+":"+instance.port+"/instancing/"+endpoint)

        let timestamp = data.lastModified || Date.now()

        const algorithm = "aes-256-cbc"; 

        const initVector = crypto.randomBytes(16);
        const Securitykey = crypto.scryptSync(instance.password, 'salt', 32);
        
        const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
        let encryptedData = cipher.update(JSON.stringify({ password: instance.password, payload: data, timestamp }), "utf-8", "hex");
        encryptedData += cipher.final("hex");
        
        const options = {
            host: instance.host.split("://")[1],
            path: "/instancing/"+endpoint,
            port: instance.port,
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            }
        }

        asyncHttp.request(options, JSON.stringify({ iv: initVector, data: encryptedData.toString() })).catch(err => { /* console.log(err) */ })
    });
}

// used to justify rejecting bad sync requests
function getOwnState() {
    return state
}
function setOwnState(val) {
    state = val
}

module.exports = {
    decryptPayload,
    getOwnState,
    setOwnState,
    getOwnPassword,
    getAllKnownInstances,
    getAllKnownAddresses,
    serverAdd: function(data) { broadcastMessage("serverAdd", data) },
    serverRemove: function(data) { broadcastMessage("serverRemove", data) },
    serverUpdate: function(data) { broadcastMessage("serverUpdate", data) },
    playerUpdate: function(data) { broadcastMessage("playerUpdate", data) },
    playerUpdateCurrentServer: function(data) { broadcastMessage("playerUpdateCurrentServer", data) },
    playerWritePersistenceBaseline: function(data) { broadcastMessage("playerWritePersistenceBaseline", data) }
}