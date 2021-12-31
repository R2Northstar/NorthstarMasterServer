import { type FastifyPluginAsync } from 'fastify'
import fastifyStatic from 'fastify-static'
import { PUBLIC_ASSETS_DIR } from '../../constants.js'

// GET /client/mainmenupromos
// returns main menu promo info

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(fastifyStatic, { root: PUBLIC_ASSETS_DIR })

  fastify.get('/client/mainmenupromos', async (_, response) => {
    return response.sendFile('mainMenuPromos.json')
  })
}

export default register
