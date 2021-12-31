import 'source-map-support/register.js'

import createFastify from 'fastify'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  LISTEN_IP,
  LISTEN_PORT,
  TRUST_PROXY,
  USE_FASTIFY_LOGGER,
} from './env/index.js'

const ROUTE_PATHS = ['client', 'server', 'account'] as const

const init = async () => {
  const fastify = await createFastify({
    logger: USE_FASTIFY_LOGGER,
    trustProxy: TRUST_PROXY,
  })

  /* eslint-disable no-await-in-loop */
  for (const routeDir of ROUTE_PATHS) {
    const cleanDir = path.join('routes', routeDir)
    const dir = path.join(__dirname, cleanDir)
    const files = await readdir(dir)

    for (const file of files) {
      if (!file.endsWith('.js')) continue

      const modulePath = path.join(dir, file)
      const module = (await import(modulePath)) as unknown

      // Ensure module has default export
      if (typeof module !== 'object') continue
      if (module === null) continue
      if (!('default' in module)) continue

      // Ensure default export is a function
      const { default: route } = module as { default: unknown }
      if (typeof route !== 'function') continue

      const cleanPath = path.join(cleanDir, file)
      console.log(`Registering routes from file ${cleanPath}`)

      // @ts-expect-error Untyped Function
      await fastify.register(route)
    }
  }
  /* eslint-enable no-await-in-loop */

  await fastify.listen(LISTEN_PORT, LISTEN_IP)
}

// Init Application
void init().catch(console.error)
