const crypto = require( "crypto" )
const path = require( "path" )
const fs = require('fs')
let banlistHash = ''


function getHash(){
        if (banlistHash == '') {
            const fileBuffer = fs.readFileSync('remote_banlist.txt')
	        const hashSum = crypto.createHash('sha256')
	        hashSum.update(fileBuffer)
	        banlistHash = hashSum.digest('hex')
        }
        return banlistHash
    }


fs.watch('remote_banlist.txt', (curr, prev) => {
    console.log('banlist changed')
    const fileBuffer = fs.readFileSync('remote_banlist.txt')
	const hashSum = crypto.createHash('sha256')
	hashSum.update(fileBuffer)
	banlistHash = hashSum.digest('hex')
})


module.exports = ( fastify, opts, done ) => {
	

    fastify.get( '/server/update_banlist', async ( request, response ) => {
		return getHash()
	})

	fastify.get( '/server/banlist', async ( request, response ) => {
		//let temp_server_banlist_version = "test"
		const fileBuffer = fs.readFileSync('remote_banlist.txt')
		return fileBuffer
	})
  
    done()
}
