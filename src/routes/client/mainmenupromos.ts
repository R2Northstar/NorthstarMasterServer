import { type FastifyPluginCallback } from 'fastify'

const fs = require('fs')
const path = require('path')

const promodataPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'assets',
  'mainmenupromodata.json'
)

// Watch the mainmenupromodata file so we can update it without a masterserver restart
fs.watch(promodataPath, (curr, previous) => {
  try {
    mainMenuPromoData = JSON.parse(fs.readFileSync(promodataPath).toString())
    console.log('updated main menu promo data successfully!')
  } catch (error) {
    console.log(`encountered error updating main menu promo data: ${error}`)
  }
})

let mainMenuPromoData = {}
if (fs.existsSync(promodataPath))
  mainMenuPromoData = JSON.parse(fs.readFileSync(promodataPath).toString())

const register: FastifyPluginCallback = (fastify, options, done) => {
  // exported routes

  // GET /client/mainmenupromos
  // returns main menu promo info
  fastify.get('/client/mainmenupromos', {}, async (request, reply) => {
    return mainMenuPromoData
  })

  done()
}

export default register
