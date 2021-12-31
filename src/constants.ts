/* eslint-disable prettier/prettier */
import ms from 'ms'
import { readFileSync } from 'node:fs' // TODO: Make async
import { join as joinPath } from 'node:path'
import { ParseDefinition } from './shared/pjson.js'

// #region Application
// 24 hours
export const TOKEN_EXPIRATION_TIME = ms('24h')
export const VERIFY_STRING = 'I am a northstar server!'
// #endregion

// #region Assets
export const ASSETS_DIR = joinPath(__dirname, '..', 'assets')
export const PUBLIC_ASSETS_DIR = joinPath(ASSETS_DIR, 'public')

const DEFAULT_PDATA_BASELINE_PATH = joinPath(ASSETS_DIR, 'default.pdata')
export const DEFAULT_PDATA_BASELINE = readFileSync(DEFAULT_PDATA_BASELINE_PATH)

const DEFAULT_PDEF_PATH = joinPath(ASSETS_DIR, 'persistent_player_data_version_231.pdef')
const DEFAULT_PDEF_BUFFER = readFileSync(DEFAULT_PDEF_PATH, 'utf8')
export const DEFAULT_PDEF_OBJECT = ParseDefinition(DEFAULT_PDEF_BUFFER)
// #endregion
