

const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("../shared/gameserver.js")
const accounts = require("../shared/accounts.js") 
const { logSync } = require("../logging.js")

module.exports = {
    // eventName: async (data) => {
    //     try { 
    //         EVENT HANDLER
    //     } catch(e) {
    //         logSync( e, 1, type="error" )
    //     }
    // }
    serverAdd: async (data) => {
        try {
            let { id, name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat, serverAuthToken } = data.payload;
            let newServer = new GameServer( name, description, playerCount, maxPlayers, map, playlist, ip, port, authPort, password, modInfo, lastHeartbeat )
            newServer.id = id;
            newServer.lastHeartbeat = lastHeartbeat;
            newServer.lastModified = data.timestamp;
            newServer.serverAuthToken = serverAuthToken;
            AddGameServer(newServer, false);
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    },
    serverRemove: async (data) => {
        try {
            RemoveGameServer(data.payload, false)
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    },
    serverUpdate: async (data) => {
        try {
            let server = GetGameServers()[ data.payload.gameserver.id ]
            UpdateGameServer(server, Object.assign(data.payload.data, { lastModified: data.timestamp }) , false)
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    },
    playerUpdate: async (data) => {
        try {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if(data.payload.account.persistentDataBaseline) data.payload.account.persistentDataBaseline = Buffer.from(data.payload.account.persistentDataBaseline)
            if ( !account ) // create account for user
            {
                await accounts.AsyncCreateAccountFromData( data.payload.account, data.timestamp )
                account = await accounts.AsyncGetPlayerByID( data.payload.id )
            }
            accounts.AsyncUpdatePlayer( account.id, data.payload.account, data.timestamp )
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    },
    playerUpdateCurrentServer: async (data) => {
        try {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( account ) {
                accounts.AsyncUpdatePlayerCurrentServer( data.payload.id, data.payload.serverId, data.timestamp )
            }
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    },
    playerWritePersistenceBaseline: async (data) => {
        try {
            let account = await accounts.AsyncGetPlayerByID( data.payload.id )
            if ( account ) {
                accounts.AsyncWritePlayerPersistenceBaseline( data.payload.id, Buffer.from(data.payload.buf), data.timestamp )
            }
        } catch(e) {
            logSync( e, 1, type="error" )
        }
    }
}