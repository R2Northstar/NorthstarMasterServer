module.exports = ( fastify, opts, done ) => {
	// exported routes
	
    // GET /
    // redirect anyone going to northstar.tf in a browser to the github
    fastify.get( '/',
    async ( request, reply ) => {
        reply.redirect( "https://github.com/R2Northstar" )
    })

    // GET /discord
    // redirect anyone going to northstar.tf/discord to the discord
    fastify.get( '/discord',
    async ( request, reply ) => {
        reply.redirect( "https://discord.gg/GYVRKC9pJh" )
    })
    
    // GET /wiki
    // redirect anyone going to northstar.tf/wiki to the wiki
    fastify.get( '/wiki',
    async ( request, reply ) => {
        reply.redirect( "https://r2northstar.gitbook.io/" )
    })

    done()
}