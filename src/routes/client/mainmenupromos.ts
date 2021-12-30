import { type FastifyPluginAsync } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'

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

const register: FastifyPluginAsync = async (fastify, _) => {
  // exported routes

  // GET /client/mainmenupromos
  // returns main menu promo info
  fastify.get('/client/mainmenupromos', {}, async () => {
    return mainMenuPromoData
  })
}

export default register
