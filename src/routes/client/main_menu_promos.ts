import { type FastifyPluginAsync } from 'fastify'
import fastifyStatic from 'fastify-static'
import path from 'node:path'

const publicAssetsPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'assets',
  'public'
)

const register: FastifyPluginAsync = async (fastify, _) => {
  await fastify.register(fastifyStatic, { root: publicAssetsPath })
  // exported routes

  // GET /client/mainmenupromos
  // returns main menu promo info
  fastify.get('/client/mainmenupromos', async (_, response) => {
    return response.sendFile('mainmenupromodata.json')
  })
}

export default register
