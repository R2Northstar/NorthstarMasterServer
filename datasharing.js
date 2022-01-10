const fs = require('fs').promises;
const http = require('http');
const https = require('https');

let instanceListPath = process.env.INSTANCE_LIST || "./instances.json"

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

async function broadcastMessage(endpoint, data) {
    instances = await getAllKnownInstances();
    instances.forEach(instance => {
        if(instance.isSelf) return;

        console.log(instance.name + " | " + instance.host+":"+instance.port+"/instancing/"+endpoint)

        const options = {
            host: instance.host.split("://")[1],
            path: "/instancing/"+endpoint,
            port: instance.port,
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: instance.password, payload: data })
        }

        let lib = http;
        if(instance.host.startsWith("https://")) {
            lib = https;
        }
        const req = lib.request(options, res => {
            console.log(`Status Code: ${res.statusCode}`)
            
            res.on('data', d => {
                console.log(JSON.parse(d.toString()))
            })
        })
        
        req.write(JSON.stringify({ password: instance.password, payload: data }));
        
        req.on('error', error => {
            console.error(error)
        })

        req.end()
    });
}

// setInterval(() => {
//     broadcastMessage("heartbeat", { msg: "I'm still here!" })
// }, 5000);

module.exports = {
    getOwnPassword,
    serverAdd: function(data) { broadcastMessage("serverAdd", data) },
    serverRemove: function(data) { broadcastMessage("serverRemove", data) },
    serverUpdate: function(data) { broadcastMessage("serverUpdate", data) },
    playerUpdate: function(data) { broadcastMessage("playerUpdate", data) },
    playerUpdateCurrentServer: function(data) { broadcastMessage("playerUpdateCurrentServer", data) },
    playerWritePersistenceBaseline: function(data) { broadcastMessage("playerWritePersistenceBaseline", data) }
}