const fs = require('fs').promises;
const http = require('http');


let params = {
    port: 12345,
    authPort: 1234,
    name: "Test server",
    description: "Bruh lol",
    map: "mp_colony",
    playlist: "hs",
    maxPlayers: 16,
    password: ""
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

let i = 0
setInterval(() => {
    if(i < 10) {
        createServer(params)
        i++
    }
}, 100);

function createServer(params) {
    let id;

    let options = {
        host: "localhost",
        path: "/server/add_server?"+new URLSearchParams(params).toString(),
        port: 80,
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
        options = {
            host: "localhost",
            path: "/server/heartbeat?"+new URLSearchParams(params2).toString(),
            port: 80,
            method: "POST"
        }
        console.log("Sending heartbeat to "+options.host+":"+options.port)
        
        let lib = http;
        const req = lib.request(options, res => {
            console.log(`Status Code: ${res.statusCode}`)
            
            res.on('data', d => {
                // console.log(JSON.parse(d.toString()))
            })
        });
        
        req.on('error', error => {
            console.error(error)
        })
        
        req.end()
    }, 5000)
}