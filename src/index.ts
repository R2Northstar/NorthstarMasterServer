import 'source-map-support/register.js'

import createFastify from 'fastify'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { LISTEN_IP, LISTEN_PORT, USE_FASTIFY_LOGGER } from './env/index.js'

const init = async () => {
  const fastify = await createFastify({ logger: USE_FASTIFY_LOGGER })
  const ROUTE_PATHS = ['client', 'server', 'account'] as const

  /* eslint-disable no-await-in-loop */
  for (const routeDir of ROUTE_PATHS) {
    const cleanDir = path.join('routes', routeDir)
    const dir = path.join(__dirname, cleanDir)
    const files = await readdir(dir)

    for (const file of files) {
      if (!file.endsWith('.js')) continue

      const modulePath = path.join(dir, file)
      const { default: module } = await import(modulePath)

      const cleanPath = path.join(cleanDir, file)
      console.log(`Registering routes from file ${cleanPath}`)

      await fastify.register(module)
    }
  }
  /* eslint-enable no-await-in-loop */

  await fastify.listen(LISTEN_PORT, LISTEN_IP)
}

void init().catch(console.error)
