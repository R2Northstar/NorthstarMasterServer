import { Buffer } from 'node:buffer'

export const NATIVE_TYPES = Object.freeze({
  int: {
    size: 4,
    nativeArrayType: false,
    read: (buf: Buffer, idx: number) => buf.readInt32LE(idx),
    write: (buf: Buffer, value: number, idx: number) => {
      buf.writeInt32LE(value, idx)
    },
  },
  float: {
    size: 4,
    nativeArrayType: false,
    read: (buf: Buffer, idx: number) => buf.readFloatLE(idx),
    write: (buf: Buffer, value: number, idx: number) => {
      buf.writeFloatLE(value, idx)
    },
  },
  bool: {
    size: 1,
    nativeArrayType: false,
    read: (buf: Buffer, idx: number) => Boolean(buf.readUInt8(idx)),
    write: (buf: Buffer, value: number, idx: number) => {
      buf.writeUInt8(value, idx)
    },
  },
  string: {
    size: 1,
    nativeArrayType: true,
    read: (buf: Buffer, idx: number, length: number) =>
      buf.toString('ascii', idx, idx + length),
    write: (buf: Buffer, value: string, idx: number, length: number) => {
      buf.write(value.padEnd(length, '\u0000'), idx, length, 'ascii')
    },
  },
})

type NativeType = keyof typeof NATIVE_TYPES
// @ts-expect-error Type Check Fn
const isNativeType: (type: string) => type is NativeType = type => {
  return type in NATIVE_TYPES
}

const ENUM_START = '$ENUM_START'
const ENUM_END = '$ENUM_END'

const STRUCT_START = '$STRUCT_START'
const STRUCT_END = '$STRUCT_END'

const PDIFF_ENUM_ADD = '$ENUM_ADD'
const PDIFF_PDEF_START = '$PROP_START'

interface PDefMember {
  type: string
  name: string
  arraySize?: string | number
  nativeArraySize?: number
}

interface PDef {
  structs: Record<string, PDefMember[]>
  enums: Record<string, string[]>
  members: PDefMember[]
}

// Reads a .pdef file, outputs all keys/values in a json format we use for this module
// eslint-disable-next-line complexity
export const parseDefinition: (pdef: string) => PDef = pdef => {
  const returnValue: PDef = {
    structs: {},
    enums: {},

    members: [],
  }

  // Falsey if not in use
  let currentEnumName
  let currentStructName

  // Read each line
  for (const line of pdef.split('\n')) {
    // Read types/names
    const split = line.trim().split(/\s+/g)
    const type = split[0]

    // Check if this is a comment line
    if (type.includes('//') || type.length === 0) continue

    // User-defined type keywords
    if (type[0].startsWith('$')) {
      if (!currentEnumName && !currentStructName) {
        const name = split[1]
        if (!/^\w+$/.test(name)) {
          throw new Error(`unexpected characters in keyword ${type}`)
        }

        if (type === ENUM_START) {
          currentEnumName = name
          returnValue.enums[currentEnumName] = []
        } else if (type === STRUCT_START) {
          currentStructName = name
          returnValue.structs[currentStructName] = []
        } else {
          throw new Error(`encountered unknown keyword ${type}`)
        }
      } else if (type === ENUM_END && currentEnumName) {
        currentEnumName = ''
      } else if (type === STRUCT_END && currentStructName) {
        currentStructName = ''
      } else {
        throw new Error(`encountered unknown case with keyword ${type}`)
      }
    }
    // We're in an enum, so enum members
    else if (currentEnumName) {
      if (!/^\w+$/.test(type)) {
        throw new Error(`unexpected characters in enum member`)
      }

      // Enums only have member names, values are just their index in the enum
      returnValue.enums[currentEnumName].push(type)
    }
    // Normal members/struct members
    else {
      const name = split[1]
      if (!/^[\w[\]{}]+$/.test(name)) {
        throw new Error(`unexpected characters in member name`)
      }

      // Preparse type name for checking
      let checkType = type

      let isNativeArrayType = false
      let isArray = false
      if (type.includes('{')) {
        // Native array types are literally only strings, which are defined with string{length}
        checkType = type.slice(0, Math.max(0, type.indexOf('{')))
        isNativeArrayType = true
      } else if (name.includes('[')) {
        isArray = true
      }

      // Verify type stuff
      if (
        !(
          checkType in NATIVE_TYPES ||
          checkType in returnValue.structs ||
          checkType in returnValue.enums
        )
      ) {
        throw new Error(`got unknown type ${checkType}`)
      } else {
        const newMember: PDefMember = { type: checkType, name }

        if (isNativeArrayType) {
          if (
            !isNativeType(checkType) ||
            !NATIVE_TYPES[checkType].nativeArrayType
          ) {
            throw new Error(
              `type ${checkType} was accessed like a native array type, while it is not one`
            )
          }

          // Pretty sure this can't be an enum and has to be a number? unsure
          newMember.nativeArraySize = Number.parseInt(
            type.slice(type.indexOf('{') + 1),
            10
          )
        } else if (isArray) {
          const bracketIndex = name.indexOf('[')
          newMember.name = name.slice(0, Math.max(0, bracketIndex))

          const arraySize = name.slice(bracketIndex + 1, name.indexOf(']'))

          newMember.arraySize =
            arraySize in returnValue.enums
              ? arraySize
              : Number.parseInt(arraySize, 10)
        }

        if (currentStructName) {
          returnValue.structs[currentStructName].push(newMember)
        } else {
          returnValue.members.push(newMember)
        }
      }
    }
  }

  return returnValue
}

interface PDiff {
  enumAdds: Record<string, string[]>
  pdefString: string
  pdef: PDef
}

export const parseDefinitionDiff: (pdiff: string) => PDiff = pdiff => {
  const returnValue: PDiff = {
    enumAdds: {},
    pdefString: '',
    pdef: {
      structs: {},
      enums: {},
      members: [],
    },
  }

  let pdefIdx = -1
  let currentEnumAddName
  const lines = pdiff.split('\n')

  // Read each line
  for (const [i, line] of lines.entries()) {
    // Read types/names
    const split = line.trim().split(/\s+/g)
    const type = split[0]

    // Check if this is a comment line
    if (type.includes('//') || type.length === 0) continue

    if (currentEnumAddName) {
      if (type === ENUM_END) {
        currentEnumAddName = ''
      } else {
        if (!/^\w+$/.test(type)) {
          throw new Error(`unexpected characters in enum member`)
        }

        returnValue.enumAdds[currentEnumAddName].push(type)
      }
    } else if (type === PDIFF_ENUM_ADD) {
      currentEnumAddName = split[1]
      if (!/^\w+$/.test(currentEnumAddName)) {
        throw new Error(`unexpected characters in enum name`)
      }

      returnValue.enumAdds[currentEnumAddName] = []
    } else if (type === PDIFF_PDEF_START) {
      pdefIdx = i + 1
      break
    } else {
      throw new Error(`hit unexpected case`)
    }
  }

  if (pdefIdx !== -1) {
    const pdef = lines.slice(pdefIdx).join('\n')
    returnValue.pdefString = pdef

    returnValue.pdef = parseDefinition(pdef)
  }

  return returnValue
}

// #region Unused for now

// function getMemberSize(member: PDefMember, parsedDef: PDef) {
//   let multiplier = 1

//   if (typeof member.arraySize === 'string') {
//     member.arraySize = parsedDef.enums[member.arraySize].length
//   }

//   multiplier *= member.arraySize ?? 1

//   if (isNativeType(member.type)) {
//     if (NATIVE_TYPES[member.type].nativeArrayType) {
//       if (member.nativeArraySize === undefined) {
//         throw new Error(
//           `member ${member.name} does not have a native arry size`
//         )
//       }

//       multiplier *= member.nativeArraySize
//     }

//     return NATIVE_TYPES[member.type].size * multiplier
//   }

//   if (member.type in parsedDef.enums) {
//     return NATIVE_TYPES.int.size * multiplier
//   }

//   if (member.type in parsedDef.structs) {
//     let structSize = 0
//     for (const structMember of parsedDef.structs[member.type]) {
//       structSize += getMemberSize(structMember, parsedDef)
//     }

//     return structSize * multiplier
//   }

//   throw new Error(`got unknown member type ${member.type}`)
// }

// Export function PdataToJson(pdata, pdef: PDef) {
//   const returnValue = {}
//   let i = 0

//   function recursiveReadPdata(struct, base) {
//     for (const member of struct) {
//       let arraySize = member.arraySize || 1
//       if (typeof arraySize === 'string') {
//         arraySize = pdef.enums[member.arraySize].length
//       }

//       const returnValueArray = []

//       for (let j = 0; j < arraySize; j++) {
//         if (member.type in NATIVE_TYPES) {
//           returnValueArray.push(
//             NATIVE_TYPES[member.type].read(pdata, i, member.nativeArraySize)
//           )

//           i += NATIVE_TYPES[member.type].size * (member.nativeArraySize || 1)
//         } else if (member.type in pdef.enums) {
//           returnValueArray.push(pdef.enums[member.type][pdata.readUInt8(i++)])
//         }
//         // Enums are uint8s
//         else if (member.type in pdef.structs) {
//           const newStruct = {}
//           recursiveReadPdata(pdef.structs[member.type], newStruct)
//           returnValueArray.push(newStruct)
//         }
//       }

//       base[member.name] = {
//         type: member.type,
//         arraySize: member.arraySize,
//         nativeArraySize: member.nativeArraySize,
//         value: member.arraySize ? returnValueArray : returnValueArray[0],
//       }
//     }
//   }

//   recursiveReadPdata(pdef.members, returnValue)

//   return returnValue
// }

// export function PdataJsonToBuffer(json, pdef, pdata) {
//   // Calc size
//   let size = 0
//   for (const member of pdef.members) size += getMemberSize(member, pdef)

//   const buf = Buffer.alloc(size)

//   let i = 0
//   const currentKey = 0
//   const keys = Object.keys(json)

//   function recursiveWritePdata(struct) {
//     for (const member of struct) {
//       let arraySize = member.arraySize || 1
//       if (typeof arraySize === 'string') {
//         arraySize = pdef.enums[arraySize].length
//       }

//       for (let j = 0; j < arraySize; j++) {
//         let value = member.value
//         if (Array.isArray(value)) value = member.value[j]

//         if (member.type in NATIVE_TYPES) {
//           NATIVE_TYPES[member.type].write(buf, value, i, member.nativeArraySize)
//           i += NATIVE_TYPES[member.type].size * (member.nativeArraySize || 1)
//         } else if (member.type in pdef.enums) {
//           buf.writeUInt8(pdef.enums[member.type].indexOf(value), i++) // Enums are uint8s
//         } else if (member.type in pdef.structs) {
//           recursiveWritePdata(value)
//         }
//       }
//     }
//   }

//   recursiveWritePdata(json)
//   return buf
// }

// #endregion
