const { getPromos } = require('../shared/mainmenupromodata.js')

module.exports = ( fastify, opts, done ) => {
	// exported routes
	
    // GET /client/mainmenupromos
    // returns main menu promo info
    fastify.get( '/client/mainmenupromos', 
    {},
    async ( request, reply ) => {
        return getPromos()
    })

    done()
}