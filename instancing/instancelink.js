const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("../shared/gameserver.js")
const instancing = require("../datasharing.js")
const accounts = require("../shared/accounts.js") 
const crypto = require("crypto");

async function decryptPayload(encryptedData, initVector) {
    const algorithm = "aes-256-cbc"; 
    const Securitykey = crypto.scryptSync(await instancing.getOwnPassword(), 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, Securitykey, Buffer.from(initVector));
    let dataBuf = Buffer.from(encryptedData);
    let decryptedData = decipher.update(encryptedData, "hex", "utf-8");
    decryptedData += decipher.final("utf8");
    return JSON.parse(decryptedData);
}

module.exports = ( fastify, opts, done ) => {
	// exported routes

	// POST /instancing/serverAdd
	fastify.post( '/instancing/serverAdd',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            let { id, name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat } = data.payload;
            let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
            newServer.id = id;
            newServer.lastHeartbeat = lastHeartbeat;
            AddGameServer(newServer, false);
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/serverRemove
	fastify.post( '/instancing/serverRemove',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            RemoveGameServer(data.payload, false)
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/serverUpdate
	fastify.post( '/instancing/serverUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            let server = GetGameServers()[ data.payload.gameserver.id ]
            UpdateGameServer(server, payload.data, false)
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerUpdate
	fastify.post( '/instancing/playerUpdate',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) // create account for user
            {
                await accounts.AsyncCreateAccountFromData( data.payload.account )
                account = await accounts.AsyncGetPlayerByID( data.payload.id )
            }
            accounts.AsyncUpdatePlayer( account.id, data.payload.account )

            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerUpdateCurrentServer
	fastify.post( '/instancing/playerUpdateCurrentServer',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncUpdatePlayerCurrentServer( data.payload.id, data.payload.serverId )
                reply.code(200).send()
            }
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerWritePersistenceBaseline
	fastify.post( '/instancing/playerWritePersistenceBaseline',
	async ( request, reply ) => {
        let data = await decryptPayload(request.body.data, request.body.iv)
        if(data.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncWritePlayerPersistenceBaseline( data.payload.id, Buffer.from(data.payload.buf) )
                reply.code(200).send()
            }
        } else {
            reply.code(401).send()
        }
	})
	
	done()
}
