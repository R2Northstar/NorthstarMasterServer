/* eslint-disable prettier/prettier */
import { registerBool, registerInt, registerString } from './register.js'

// #region Globals
const NODE_ENV = registerString('NODE_ENV')
const IS_PROD = NODE_ENV?.toLowerCase() === 'production'
export const IS_DEV = !IS_PROD
// #endregion

// #region HTTP
export const LISTEN_PORT = registerInt('LISTEN_PORT') ?? 3000
export const LISTEN_IP = registerString('LISTEN_IP') ?? '0.0.0.0'
export const USE_FASTIFY_LOGGER = registerBool('USE_FASTIFY_LOGGER') ?? false
export const TRUST_PROXY = registerBool('TRUST_PROXY') ?? true
// #endregion

// #region Database Driver
type SupportedDriver = typeof supportedDrivers[number]
const supportedDrivers = ['sqlite', 'pg'] as const

// @ts-expect-error Type Check Function
export const isSupportedDriver: (
  driver: string
) => driver is SupportedDriver = driver => {
  // @ts-expect-error Type Check Function
  return supportedDrivers.includes(driver)
}

const dbDriver = registerString('DB_DRIVER') ?? 'sqlite'
if (!isSupportedDriver(dbDriver)) {
  const message = `unsupported db driver: ${dbDriver}\nselect one of: ${supportedDrivers.join(', ')}`
  throw new Error(message)
}

export const DB_DRIVER = dbDriver
// #endregion

// #region Database Settings
export const DB_SQLITE_FILE_NAME = registerString('DB_SQLITE_FILE_NAME') ?? './playerdata.db'
export const DB_PSQL_CONN = registerString('DB_PSQL_CONN', DB_DRIVER === 'pg')
// #endregion

// #region Application
export const REQUIRE_SESSION_TOKEN = registerBool('REQUIRE_SESSION_TOKEN') ?? true
export const SYNC_GAME_SERVERS = registerBool('SYNC_GAME_SERVERS') ?? !IS_DEV
export const CACHE_GAME_SERVERS = registerBool('CACHE_GAME_SERVERS') ?? !IS_DEV
export const REDIS_CONN = registerString('REDIS_CONN', SYNC_GAME_SERVERS || CACHE_GAME_SERVERS)
// #endregion
