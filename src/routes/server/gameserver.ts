import { type FastifyPluginCallback } from "fastify"
import axios from "axios"
import { GameServer, GetGameServers, AddGameServer, RemoveGameServer } from '../../shared/gameserver.js'
import { type Static, Type } from '@sinclair/typebox'

const path = require( "path" )
const crypto = require( "crypto" )
const pjson = require( "../../shared/pjson.js" )
const Filter = require('bad-words')
let filter = new Filter();

const VERIFY_STRING = "I am a northstar server!"

const register: FastifyPluginCallback = (fastify, opts, done) => {
	fastify.register( require( "fastify-multipart" ) )

	// exported routes

	const AddServerQuery = Type.Object({
		// the port the gameserver is being hosted on ( for connect )
		port: Type.Integer(),

		// the port the server's http auth server is being hosted on
		authPort: Type.Integer(),

		// the name of the server
		name: Type.String(),

		// the description of the server
		description: Type.String(),

		// the map the server is on
		map: Type.String(),

		// the playlist the server is using
		playlist: Type.String(),

		// the maximum number of players the server accepts
		maxPlayers: Type.Integer(),

		// the server's password, if 0 length, the server does not accept a password
		password: Type.String(),
	})

	// POST /server/add_server
	// adds a gameserver to the server list
	fastify.post<{ Querystring: Static<typeof AddServerQuery> }>( '/server/add_server',
	{
		schema: {
			querystring: AddServerQuery
		}
	},
	async ( request, reply ) => {
		// check server's verify endpoint on their auth server, make sure it's fine
		// in the future we could probably check the server's connect port too, with a c2s_connect packet or smth, but atm this is good enough

		let hasValidModInfo = true
		let modInfo

		if ( request.isMultipart() )
		{
			try
			{
				modInfo = JSON.parse( ( await ( await request.file() ).toBuffer() ).toString() )
				hasValidModInfo = Array.isArray( modInfo.Mods )
			}
			catch ( ex ) {}
		}

		// TODO: Handle errors
		let { data: authServerResponse } = await axios.get<string>(`http://${request.ip}:${request.query.authPort}/verify`, { responseType: 'text' })

		if ( !authServerResponse || authServerResponse.toString() != VERIFY_STRING )
			return { success: false }

		// pdiff stuff
		if ( modInfo && modInfo.Mods )
		{
			for ( let mod of modInfo.Mods )
			{
				if ( !!mod.pdiff )
				{
					try
					{
						let pdiffHash = crypto.createHash( "sha1" ).update( mod.pdiff ).digest( "hex" )
						mod.pdiff = pjson.ParseDefinitionDiffs( mod.pdiff )
						mod.pdiff.hash = pdiffHash
					}
					catch ( ex )
					{
						mod.pdiff = null
					}
				}
			}
		}

		let name = filter.clean( request.query.name )
		let description = request.query.description == "" ? "" : filter.clean( request.query.description )
		let newServer = new GameServer( name, description, 0, request.query.maxPlayers, request.query.map, request.query.playlist, request.ip, request.query.port, request.query.authPort, request.query.password, modInfo )
		AddGameServer( newServer )

		return {
			success: true,
			id: newServer.id,
			serverAuthToken: newServer.serverAuthToken
		}
	})

	const HeartbeatQuery = Type.Object({
		// the id of the server sending this message
		id: Type.String(),
		playerCount: Type.Integer(),
	})

	// POST /server/heartbeat
	// refreshes a gameserver's last heartbeat time, gameservers are removed after 30 seconds without a heartbeat
	fastify.post<{ Querystring: Static<typeof HeartbeatQuery> }>( '/server/heartbeat',
	{
		schema: {
			querystring: HeartbeatQuery
		}
	},
	async ( request, reply ) => {
		let server = GetGameServers()[ request.query.id ]
		// dont update if the server doesnt exist, or the server isnt the one sending the heartbeat
		if ( !server || request.ip != server.ip || !request.query.id )// remove !request.playerCount as if playercount==0 it will trigger skip heartbeat update
		{
			return null
		}

		else								// Added else so update heartbeat will trigger,Have to add the brackets for me to work for some reason
		{
			server.lastHeartbeat = Date.now()
			server.playerCount = request.query.playerCount
			return null
		}
	})

	// POST /server/update_values
	// updates values shown on the server list, such as map, playlist, or player count
	// no schema for this one, since it's fully dynamic and fastify doesnt do optional params
	fastify.post( '/server/update_values', async ( request, reply ) => {
		if ( !( "id" in request.query ) )
			return null

		let server = GetGameServers()[ request.query.id ]

		// if server doesn't exist, try adding it
		if ( !server )
		{
			return SharedTryAddServer( request )
		}
		else if ( request.ip != server.ip ) // dont update if the server isnt the one sending the heartbeat
			return null

		// update heartbeat
		server.lastHeartbeat = Date.now()

		for ( let key of Object.keys( request.query ) )
		{
			if ( key == "id" || key == "port" || key == "authport" || !( key in server ) || request.query[ key ].length >= 512 )
				continue

			if ( key == "playerCount" || key == "maxPlayers" )
			{
				server[ key ] = parseInt( request.query[ key ] )
			}
			else						//i suppose maybe add the brackets here to as upper one works with it. but actually its fine not to i guess.
			{
				server[ key ] = request.query[ key ]
			}
		}

		return null
	})

	const RemoveServerQuery = Type.Object({
		id: Type.String(),
	})

	// DELETE /server/remove_server
	// removes a gameserver from the server list
	fastify.delete<{ Querystring: Static<typeof RemoveServerQuery> }>( '/server/remove_server',
	{
		schema: {
			querystring: RemoveServerQuery
		}
	},
	async ( request, reply ) => {
		let server = GetGameServers()[ request.query.id ]
		// dont remove if the server doesnt exist, or the server isnt the one sending the heartbeat
		if ( !server || request.ip != server.ip )
			return null

		RemoveGameServer( server )
		return null
	})

	done()
}

export default register
