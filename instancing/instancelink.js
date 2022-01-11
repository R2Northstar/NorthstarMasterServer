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
	fastify.post( '/instancing/serverAdd',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            let { id, name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat } = data.payload;
            let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
            newServer.id = id;
            newServer.lastHeartbeat = lastHeartbeat;
            AddGameServer(newServer, false);
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/serverRemove
	fastify.post( '/instancing/serverRemove',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            RemoveGameServer(data.payload, false)

            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/serverUpdate
	fastify.post( '/instancing/serverUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            let server = GetGameServers()[ data.payload.gameserver.id ]
            UpdateGameServer(server, data.payload.data, false)
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerUpdate
	fastify.post( '/instancing/playerUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if(data.payload.account.persistentDataBaseline) data.payload.account.persistentDataBaseline = Buffer.from(data.payload.account.persistentDataBaseline)
            if ( !account ) // create account for user
            {
                await accounts.AsyncCreateAccountFromData( data.payload.account )
                account = await accounts.AsyncGetPlayerByID( data.payload.id )
            }
            accounts.AsyncUpdatePlayer( account.id, data.payload.account )
            
            reply.code(200).send("200 OK")
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerUpdateCurrentServer
	fastify.post( '/instancing/playerUpdateCurrentServer',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncUpdatePlayerCurrentServer( data.payload.id, data.payload.serverId )
            
                reply.code(200).send("200 OK")
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/playerWritePersistenceBaseline
	fastify.post( '/instancing/playerWritePersistenceBaseline',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncWritePlayerPersistenceBaseline( data.payload.id, Buffer.from(data.payload.buf) )
            
                reply.code(200).send("200 OK")
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

	// POST /instancing/state
	fastify.post( '/instancing/state',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
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
                console.log(e)
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

    // POST /instancing/sync/servers
	fastify.post( '/instancing/sync/servers',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
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
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})

    // POST /instancing/sync/accounts
	fastify.post( '/instancing/sync/accounts',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body)
        if(data.password == await instancing.getOwnPassword()) {
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
                reply.code(500).send()
            }
        } else {
            reply.code(401).send("401 Unauthorized")
        }
	})
	
	done()
}
