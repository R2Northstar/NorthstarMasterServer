const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("../shared/gameserver.js")
const instancing = require("../datasharing.js")
const accounts = require("../shared/accounts.js") 
const crypto = require("crypto");

async function decryptPayload(body, password) {
    try {
        if(!password) password = await instancing.getOwnPassword()

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
        return {}
    }
}

module.exports = ( fastify, opts, done ) => {
	// exported routes

	// POST /instancing/serverAdd
    // used to receive new server broadcasts
	fastify.post( '/instancing/serverAdd',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            let { id, name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat } = data.payload;
            let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
            newServer.id = id;
            newServer.lastHeartbeat = lastHeartbeat;
            newServer.lastModified = data.timestamp;
            AddGameServer(newServer, false);
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/serverRemove
    // used to receive broadcasts of server removal
	fastify.post( '/instancing/serverRemove',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            RemoveGameServer(data.payload, false)

            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/serverUpdate
    // used to receive broadcasts for server changes
	fastify.post( '/instancing/serverUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            let server = GetGameServers()[ data.payload.gameserver.id ]
            UpdateGameServer(server, Object.assign(data.payload.data, { lastModified: data.timestamp }) , false)
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerUpdate
    // receive broadcasts for player changes
	fastify.post( '/instancing/playerUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if(data.payload.account.persistentDataBaseline) data.payload.account.persistentDataBaseline = Buffer.from(data.payload.account.persistentDataBaseline)
            if ( !account ) // create account for user
            {
                await accounts.AsyncCreateAccountFromData( data.payload.account, data.timestamp )
                account = await accounts.AsyncGetPlayerByID( data.payload.id )
            }
            accounts.AsyncUpdatePlayer( account.id, data.payload.account, data.timestamp )
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerUpdateCurrentServer
    // receive broadcasts for when the player's server changes
	fastify.post( '/instancing/playerUpdateCurrentServer',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncUpdatePlayerCurrentServer( data.payload.id, data.payload.serverId, data.timestamp )
            
                reply.code(200).send("200 OK")
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerWritePersistenceBaseline
    // used to receive broadcasts for saving a player's pdata
	fastify.post( '/instancing/playerWritePersistenceBaseline',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncWritePlayerPersistenceBaseline( data.payload.id, Buffer.from(data.payload.buf), data.timestamp )
            
                reply.code(200).send("200 OK")
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/state
    // inform other instances of the current sync state on request (0=Starting, 1=Syncing, 2=Running), they should only proceed with syncing if state=2
	fastify.post( '/instancing/state',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            try {
                let data = { state: instancing.getOwnState() }

                const algorithm = "aes-256-cbc"; 

                const initVector = crypto.randomBytes(16);
                const Securitykey = crypto.scryptSync(await instancing.getOwnPassword(), 'salt', 32);
                
                const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
                let encryptedData = cipher.update(JSON.stringify(data), "utf-8", "hex");
                encryptedData += cipher.final("hex");

                reply.code(200).send(JSON.stringify({ iv: initVector, data: encryptedData }))
            } catch(e) {
                // console.log(e)
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

    // POST /instancing/sync/servers
    // instances can ask for an entire server list from this one
	fastify.post( '/instancing/sync/servers',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            try {
                let servers = GetGameServers()
                let data = { servers }

                const algorithm = "aes-256-cbc"; 

                const initVector = crypto.randomBytes(16);
                const Securitykey = crypto.scryptSync(await instancing.getOwnPassword(), 'salt', 32);
                
                const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
                let encryptedData = cipher.update(JSON.stringify(data), "utf-8", "hex");
                encryptedData += cipher.final("hex");

                reply.code(200).send(JSON.stringify({ iv: initVector, data: encryptedData }))
            } catch(e) {
                // console.log(e)
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

    // POST /instancing/sync/accounts
    // another instance can yoink the account data in the db so it can be up-to-date
	fastify.post( '/instancing/sync/accounts',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword() && (await instancing.getAllKnownAddresses()).indexOf(request.ip) != -1) {
            try {
                let data = { accounts: await accounts.AsyncGetAllPlayers() }
                
                const algorithm = "aes-256-cbc"; 

                const initVector = crypto.randomBytes(16);
                const Securitykey = crypto.scryptSync(await instancing.getOwnPassword(), 'salt', 32);
                
                const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
                let encryptedData = cipher.update(JSON.stringify(data), "utf-8", "hex");
                encryptedData += cipher.final("hex");

                reply.code(200).send(JSON.stringify({ iv: initVector, data: encryptedData }))
            } catch(e) {
                // console.log(e)
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})
	
	done()
}
