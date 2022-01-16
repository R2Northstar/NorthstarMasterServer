const util = require('util');
const dns = require('dns');
const lookup = util.promisify(dns.lookup);

const fs = require("fs");
let instanceListPath = process.env.INSTANCE_LIST || "./instances.json"
let instances = JSON.parse(fs.readFileSync(instanceListPath, 'utf-8'));

fs.watch(instanceListPath, eventType => {
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
    getAllKnownInstances,
    getInstanceById,
    getOwnInstance,
    getInstanceAddress,
    getAllKnownAddresses
}