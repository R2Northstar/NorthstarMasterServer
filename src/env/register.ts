import { config } from 'dotenv'
import { env } from 'node:process'

// Load from .env
config()

function _string(name: string, required?: false): string | undefined
function _string(name: string, required: true): string
function _string(name: string, required: boolean): string | undefined
function _string(name: string, required = false): string | undefined {
  const value = env[name]
  if (value === undefined) {
    if (required) throw new Error(`Missing environment variable \`${name}\``)
    return undefined
  }

  return value
}

const trueValues = new Set(['true', 't', '1', 'yes', 'y'])
const falseValues = new Set(['false', 'f', '0', 'no', 'n'])

function bool(name: string, required?: false): boolean | undefined
function bool(name: string, required: true): boolean
function bool(name: string, required = false): boolean | undefined {
  const value = env[name]
  if (value === undefined) {
    if (required) throw new Error(`Missing environment variable \`${name}\``)
    return undefined
  }

  const isTrue = trueValues.has(value.toLowerCase())
  const isFalse = falseValues.has(value.toLowerCase())
  if (isTrue === false && isFalse === false) {
    throw new TypeError(
      `Invalid environment variable \`${name}\` : expected type \`bool\``
    )
  }

  if (isTrue) return true
  if (isFalse) return false
}

function int(name: string, required?: false): number | undefined
function int(name: string, required: true): number
function int(name: string, required = false): number | undefined {
  const value = env[name]
  if (value === undefined) {
    if (required) throw new Error(`Missing environment variable \`${name}\``)
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new TypeError(
      `Invalid environment variable \`${name}\` : expected type \`int\``
    )
  }

  return parsed
}

export { _string as registerString, bool as registerBool, int as registerInt }
