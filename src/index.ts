import 'source-map-support/register.js'

import createFastify from 'fastify'
import ms from 'ms'
import { readdir } from 'node:fs/promises'
import { join as joinPath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT_DIR } from '~constants.js'
import {
  LISTEN_IP,
  LISTEN_PORT,
  TRUST_PROXY,
  USE_FASTIFY_LOGGER,
} from '~env/index.js'
import { sweepGameServers } from '~gameservers/sweep.js'

const ROUTE_PATHS = ['client', 'server', 'account'] as const

const init = async () => {
  const fastify = await createFastify({
    logger: USE_FASTIFY_LOGGER,
    trustProxy: TRUST_PROXY,
  })

  /* eslint-disable no-await-in-loop */
  for (const routeDir of ROUTE_PATHS) {
    const cleanDir = joinPath('routes', routeDir)
    const dir = joinPath(ROOT_DIR, cleanDir)
    const files = await readdir(dir)

    for (const file of files) {
      if (!file.endsWith('.js')) continue

      const { href: modulePath } = pathToFileURL(joinPath(dir, file))
      // eslint-disable-next-line node/no-unsupported-features/es-syntax
      const module = (await import(modulePath)) as unknown

      // Ensure module has default export
      if (typeof module !== 'object') continue
      if (module === null) continue
      if (!('default' in module)) continue

      // Ensure default export is a function
      const { default: route } = module as { default: unknown }
      if (typeof route !== 'function') continue

      const cleanPath = joinPath(cleanDir, file)
      console.log(`Registering routes from file ${cleanPath}`)

      // @ts-expect-error Untyped Function
      await fastify.register(route)
    }
  }
  /* eslint-enable no-await-in-loop */

  // Periodically sweep game servers
  void sweepGameServers()
  setInterval(() => {
    void sweepGameServers()
  }, ms('10s'))

  await fastify.listen(LISTEN_PORT, LISTEN_IP)
}

// Init Application
await init().catch(console.error)
