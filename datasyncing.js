const http = require('http');
const https = require('https');
const crypto = require("crypto");
const asyncHttp = require("./shared/asynchttp.js") 

const accounts = require("./shared/accounts.js") 
const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("./shared/gameserver.js")
const { decryptPayload, getAllKnownInstances, getOwnState, setOwnState } = require("./datasharing.js")

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array
}

async function attemptSyncWithAny() {
    console.log("Attempting to sync with first available server")
    setOwnState(1)
    // Attempt to sync with any up-and-running masterserver
    let hasSynced = false;
    instances = shuffleArray(await getAllKnownInstances());
    instances.forEach(async instance => {
        if(instance.isSelf || hasSynced) return;

        try {
            let instanceState = await getInstanceState(instance);

            if(instanceState == 2) {
                console.log("Attempting sync with instance "+instance.name)
                // Sync game servers
                let currentServers = GetGameServers();

                let servers = await serverSyncWithInstance(instance);

                for(let i = 0; i < Object.keys(servers).length; i++) {
                    let id = Object.keys(servers)[i]
                    if(currentServers[id]) {
                        UpdateGameServer(currentServers[id], servers[id], false)
                    } else {
                        let { name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat } = servers[id];
                        let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
                        newServer.id = id;
                        newServer.lastHeartbeat = lastHeartbeat;
                        AddGameServer(newServer, false)
                    }
                }

                // Sync accounts in DB
                let accountList = await accountSyncWithInstance(instance);
                accountList.forEach(async accountJson => {
                    let account = await accounts.AsyncGetPlayerByID( accountJson.id )
                    if(accountJson.persistentDataBaseline) accountJson.persistentDataBaseline = Buffer.from(accountJson.persistentDataBaseline)
                    if ( !account ) // create account for user
                    {
                        await accounts.AsyncCreateAccountFromData( accountJson )
                        account = await accounts.AsyncGetPlayerByID( accountJson.id )
                    } else {
                        if(accountJson.lastModified > account.lastModified) accounts.AsyncUpdatePlayer( account.id, accountJson.account )
                    }
                });

                console.log("Successfully synced with instance "+instance.name)
                setOwnState(2)
                hasSynced = true;
                return
            }
        } catch(e) {
            return
        }
    });

    setTimeout(() => {
        if(!hasSynced) {
            // Skip if none available
            console.log("Sync timed out")
            hasSynced = true;
            setOwnState(2)
        }
    }, 2500);
}

async function getInstanceState(instance) {
    return (await askForData("state", instance)).state
}
async function serverSyncWithInstance(instance) {
    return (await askForData("sync/servers", instance)).servers
}
async function accountSyncWithInstance(instance) {
    return (await askForData("sync/accounts", instance)).accounts
}

function askForData(endpoint, instance) {
    return new Promise(async (resolve, reject) => {
        try {
            const algorithm = "aes-256-cbc"; 

            const initVector = crypto.randomBytes(16);
            const Securitykey = crypto.scryptSync(instance.password, 'salt', 32);
            
            const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
            let encryptedData = cipher.update(JSON.stringify({ password: instance.password }), "utf-8", "hex");
            encryptedData += cipher.final("hex");
            
            const options = {
                host: instance.host.split("://")[1],
                path: "/instancing/"+endpoint,
                port: instance.port,
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ iv: initVector, data: encryptedData })
            }

            let res = await asyncHttp.request(options, JSON.stringify({ iv: initVector, data: encryptedData.toString() }))
            
            let decryptedData = await decryptPayload(JSON.parse(res.toString()), instance.password);
            resolve(decryptedData);
        } catch(e) {
            // console.log(e)
            reject(e)
        }
    })
}


module.exports = {
    attemptSyncWithAny,
    getInstanceState
}