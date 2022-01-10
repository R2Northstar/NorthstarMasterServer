const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("../shared/gameserver.js")
const instancing = require("../datasharing.js")
const accounts = require("../shared/accounts.js") 

module.exports = ( fastify, opts, done ) => {
	// exported routes
	
	// POST /instancing/heartbeat
	fastify.post( '/instancing/heartbeat',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/serverAdd
	fastify.post( '/instancing/serverAdd',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            let { id, name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat } = request.body.payload
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
        if(request.body.password == await instancing.getOwnPassword()) {
            RemoveGameServer(request.body.payload, false)
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/serverUpdate
	fastify.post( '/instancing/serverUpdate',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            let server = GetGameServers()[ request.body.payload.gameserver.id ]
            UpdateGameServer(server, request.body.payload.data, false)
            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerUpdate
	fastify.post( '/instancing/playerUpdate',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( request.body.payload.id )
            if ( !account ) // create account for user
            {
                await accounts.AsyncCreateAccountFromData( request.body.payload.account )
                account = await accounts.AsyncGetPlayerByID( request.body.payload.id )
            }
            accounts.AsyncUpdatePlayer( account.id, request.body.payload.account )

            reply.code(200).send()
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerUpdateCurrentServer
	fastify.post( '/instancing/playerUpdateCurrentServer',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( request.body.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncUpdatePlayerCurrentServer( request.body.payload.id, request.body.payload.serverId )
                reply.code(200).send()
            }
        } else {
            reply.code(401).send()
        }
	})

	// POST /instancing/playerWritePersistenceBaseline
	fastify.post( '/instancing/playerWritePersistenceBaseline',
	async ( request, reply ) => {
        if(request.body.password == await instancing.getOwnPassword()) {
            let account = await accounts.AsyncGetPlayerByID( request.body.payload.id )
            if ( !account ) {
                reply.code(500).send()
            } else {
                accounts.AsyncWritePlayerPersistenceBaseline( request.body.payload.id, request.body.payload.buf )
                reply.code(200).send()
            }
        } else {
            reply.code(401).send()
        }
	})
	
	done()
}
