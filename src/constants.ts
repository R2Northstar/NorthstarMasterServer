/* eslint-disable prettier/prettier */
import ms from 'ms'
import { readFile } from 'node:fs/promises'
import { dirname as dirName, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDefinition } from '~pjson.js'

// #region Application
export const ROOT_DIR = dirName(fileURLToPath(import.meta.url))
export const TOKEN_EXPIRATION_TIME = ms('24h')
export const VERIFY_STRING = 'I am a northstar server!'
// #endregion

// #region Assets
export const ASSETS_DIR = joinPath(ROOT_DIR, '..', 'assets')
export const PUBLIC_ASSETS_DIR = joinPath(ASSETS_DIR, 'public')

const DEFAULT_PDATA_BASELINE_PATH = joinPath(ASSETS_DIR, 'default.pdata')
export const DEFAULT_PDATA_BASELINE = await readFile(DEFAULT_PDATA_BASELINE_PATH)

const DEFAULT_PDEF_PATH = joinPath(ASSETS_DIR, 'persistent_player_data_version_231.pdef')
const DEFAULT_PDEF_BUFFER = await readFile(DEFAULT_PDEF_PATH, 'utf8')
export const DEFAULT_PDEF_OBJECT = parseDefinition(DEFAULT_PDEF_BUFFER)
// #endregion
