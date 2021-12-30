import 'source-map-support/register.js'

import dotenv from 'dotenv'
import createFastify from 'fastify'
import fs from 'node:fs'
import path from 'node:path'

if (process.argv.includes('-devenv')) dotenv.config({ path: './dev.env' })
else dotenv.config()

const fastify = process.env.USE_HTTPS
  ? createFastify({
      logger: process.env.USE_FASTIFY_LOGGER || false,
      https: {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH),
      },
    })
  : createFastify({
      logger: process.env.USE_FASTIFY_LOGGER || false,
    })

const ROUTE_PATHS = ['client', 'server', 'account'] as const

for (const routePath of ROUTE_PATHS) {
  const dir = path.join(__dirname, 'routes', routePath)

  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.js')) {
      console.log(`Registering routes from file ${path.join(dir, file)}`)
      fastify.register(require(path.join(dir, file)))
    }
  }
}

async function start() {
  try {
    await fastify.listen(
      process.env.LISTEN_PORT || 80,
      process.env.LISTEN_IP || '0.0.0.0'
    )
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

start()
