const util = require('util');
const dns = require('dns');
const lookup = util.promisify(dns.lookup);

const fs = require("fs");
let instanceListPath = process.env.INSTANCE_LIST || "./instances.json"
let instances = JSON.parse(fs.readFileSync(instanceListPath, 'utf-8'));
let isInstancesReady = false;

const crypto = require("crypto");
let privateKey = fs.readFileSync("./rsa_4096_priv.pem").toString()

const { logSync } = require("../logging.js")

function decrypt(toDecrypt, privateKey) {
    const buffer = Buffer.from(toDecrypt, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: '',
      },
      buffer,
    )
    return decrypted.toString('utf8')
}

const { validate } = require('jsonschema');
const instancesSchema = {
    "type": "array",
    "items": {
        "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "host": { "type": "string" },
            "incomingAddress": { "type": "string" },
            "secure": { "type": "boolean" },
            "port": { "type": "integer" }
        },
        "required": ["id", "name", "host", "incomingAddress", "secure", "port"],
        "uniqueItems": true
    }
};

const asyncHttp = require("../shared/asynchttp.js") 
async function getRemoteInstances(url) {
    try {
        logSync('Attempting to fetch remote instances file', 2);
        url = new URL(url)
        let resBuffer = await asyncHttp.request({
            method: "GET",
            host: (url.protocol == "https:" ? "https://" : "")+url.hostname,
            port: url.port,
            path: url.pathname
        })
        let proposed = JSON.parse(decrypt(resBuffer.toString(), privateKey));
        let { valid } = validate(proposed, instancesSchema);
        if(valid) {
            logSync('Remote instances JSON meets schema, saving', 2);
            instances = proposed;
        } else {
            logSync('Remote instances JSON does not meet schema', 2, "warn");
        }
        isInstancesReady = true
    } catch(e) {
        isInstancesReady = true
        logSync(e.toString(), 1, type="error")
    }
}

if(process.env.INSTANCE_LIST_REMOTE) {
    getRemoteInstances(process.env.INSTANCE_LIST_REMOTE)
} else {
    isInstancesReady = true
    fs.watch(instanceListPath, eventType => {
        try {
            if(eventType == "change") {
                let fileData = fs.readFileSync(instanceListPath, 'utf-8');
                let fileJson = JSON.parse(fileData);
                instances = fileJson;
            }
        } catch(e) {
            logSync(e.toString(), 1, type="error")
        }
    });
}


// Check instance ready state until timeout
var timeoutCycles = 50
var checkDelay = 10
async function instancesReady( resolve ) {
	for ( let i = 0; i < timeoutCycles; i++ )
	{
		await new Promise( res => setTimeout( res, checkDelay ) )
		if ( isInstancesReady )
		{
			break
		}
	}
	resolve()
}

// gets a list of instances from the json file
function getAllKnownInstances() {
    return new Promise((resolve, reject) => {
        try {
            resolve(instances);
        } catch(e) {
            reject(e);
        }
    });
}
// gets a specific instance from the json file
function getInstanceById(id) {
    return instances.find(inst => inst.id == id);
}
// gets own instance from the json file based on id env var
function getOwnInstance() {
    return new Promise((resolve, reject) => {
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
            if(instance.incomingAddress) resolve(instance.incomingAddress)
            else resolve( (await lookup(instance.host)).address );
        } catch(e) {
            reject(e);
        }
    });
}

module.exports = {
    instancesReady,
    getAllKnownInstances,
    getInstanceById,
    getOwnInstance,
    getInstanceAddress,
    getAllKnownAddresses
}