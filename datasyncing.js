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
    accounts.BackupDatabase() // backup DB on startup in case of big oopsie

    console.log("Attempting to sync with first available server")
    setOwnState(1)
    // Attempt to sync with any up-and-running masterserver
    let hasSynced = false;
    instances = shuffleArray(await getAllKnownInstances());
    for(instance of instances) {
        if(!instance.isSelf && !hasSynced) {
            try {
                let instanceState = await getInstanceState(instance);

                if(instanceState == 2) {
                    try {
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
                        console.log("Synced servers with instance "+instance.name)

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
                        console.log("Synced accounts with instance "+instance.name)

                        console.log("Completed sync with instance "+instance.name)
                        setOwnState(2)
                        hasSynced = true;
                    } catch(e) {
                        console.log("Failed to complete sync with instance "+instance.name)
                    }
                }
            } catch(e) {
                // console.log(e)
            }
        }
    }

    // Skip if none available
    if(!hasSynced) {
        console.log("Sync could not be completed")
        setOwnState(2)
    }

    // backup server every n minutes in case of oopsie
    console.log(`Will attempt to backup DB every ${process.env.DB_BACKUP_MINUTES || 30} minutes`)
    setInterval(() => {
        accounts.BackupDatabase()
    }, (process.env.DB_BACKUP_MINUTES || 30)*60000)
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
                }
            }

            let res = await asyncHttp.request(options, JSON.stringify({ iv: initVector, timestamp: Date.now(), data: encryptedData.toString() }))
            
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