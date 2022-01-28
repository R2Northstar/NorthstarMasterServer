const { getPromos } = require('../shared/mainmenupromodata.js')

module.exports = ( fastify, opts, done ) => {
	// exported routes

    // GET /client/mainmenupromos
    // returns main menu promo info
    fastify.get( '/client/mainmenupromos',
    {
		config: { rateLimit: getRatelimit("REQ_PER_MINUTE__CLIENT_MAINMENUPROMOS") }, // ratelimit
    },
    async ( request, reply ) => {
        return getPromos()
    })

    done()
}