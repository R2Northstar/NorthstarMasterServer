const fs = require('fs').promises;
const http = require('http');


let params = {
    port: 12345, // the port the gameserver is being hosted on ( for connect )
    authPort: 1234, // the port the server's http auth server is being hosted on
    name: "Test server", // the name of the server
    description: "Bruh lol", // the description of the server
    map: "mp_colony", // the map the server is on
    playlist: "hs", // the playlist the server is using
    maxPlayers: 16, // the maximum number of players the server accepts
    password: "" // the server's password, if 0 length, the server does not accept a password
}

let fastify = require( "fastify" )()

async function start() 
{
	try 
	{
        fastify.get("/verify", async ( request, reply ) => {
            return "I am a northstar server!"
        })
		await fastify.listen( params.authPort, "0.0.0.0" )
	} 
	catch ( ex )
	{
		console.error( ex )
		process.exit( 1 )
	}
}

start()

let id;

const options = {
    host: "localhost",
    path: "/server/add_server?"+new URLSearchParams(params).toString(),
    port: 81,
    method: "POST"
}

console.log("Trying to add dummy server to "+options.host+":"+options.port)

let lib = http;
const req = lib.request(options, res => {
    console.log(`Status Code: ${res.statusCode}`)
    
    res.on('data', d => {
        console.log(JSON.parse(d.toString()))
        id = JSON.parse(d.toString()).id;
    })
});

req.on('error', error => {
    console.error(error)
})

req.end()

setInterval(() => {
    let params2 = {
        id: id,
        playerCount: Math.floor(Math.random()*16)
    }
    const options = {
        host: "localhost",
        path: "/server/heartbeat?"+new URLSearchParams(params2).toString(),
        port: 80,
        method: "POST"
    }
    
    let lib = http;
    const req = lib.request(options, res => {
        console.log(`Status Code: ${res.statusCode}`)
        
        res.on('data', d => {
            console.log(JSON.parse(d.toString()))
        })
    });
    
    req.on('error', error => {
        console.error(error)
    })
    
    req.end()
}, 5000)