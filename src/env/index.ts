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

// #region Application
export const REQUIRE_SESSION_TOKEN = registerBool('REQUIRE_SESSION_TOKEN') ?? true
// #endregion
