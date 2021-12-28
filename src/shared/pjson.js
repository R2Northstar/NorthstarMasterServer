const NATIVE_TYPES = {
    int: { size: 4,
        read: ( buf, idx ) => buf.readInt32LE( idx ),
        write: ( buf, value, idx ) => buf.writeInt32LE( value, idx )
    },
    float: { size: 4,
        read: ( buf, idx ) => buf.readFloatLE( idx ),
        write: ( buf, value, idx ) => buf.writeFloatLE( value, idx )
    },
    bool: {
        size: 1,
        read: ( buf, idx ) => !!buf.readUInt8( idx ),
        write: ( buf, value, idx ) => buf.writeUint8( value, idx )
    },
    string: {
        size: 1,
        nativeArrayType: true,
        read: ( buf, idx, length ) => buf.toString( 'ascii', idx, idx + length ),
        write: ( buf, value, idx, length ) => buf.write( value.padEnd( length, '\u0000' ), idx, length, 'ascii' )
    }
}

const ENUM_START = "$ENUM_START"
const ENUM_END = "$ENUM_END"

const STRUCT_START = "$STRUCT_START"
const STRUCT_END = "$STRUCT_END"

const PDIFF_ENUM_ADD = "$ENUM_ADD"
const PDIFF_PDEF_START = "$PROP_START"

// reads a .pdef file, outputs all keys/values in a json format we use for this module
function ParseDefinition( pdef )
{
    let ret = {
        structs: {},
        enums: {},

        members: []
    }

    // falsey if not in use
    let currentEnumName
    let currentStructName

    // read each line
    for ( let line of pdef.split( '\n' ) )
    {
        // read types/names
        let split = line.trim().split( /\s+/g )
        let type = split[ 0 ]

        // check if this is a comment line
        if ( type.includes( "//" ) || type.length == 0 )
            continue

        // user-defined type keywords
        if ( type[ 0 ][ 0 ] == '$' )
        {
            if ( !currentEnumName && !currentStructName )
            {
                let name = split[ 1 ]
                if ( !name.match( /^\w+$/ ) )
                    throw new Error( `unexpected characters in keyword ${type}` )

                if ( type == ENUM_START )
                {
                    currentEnumName = name
                    ret.enums[ currentEnumName ] = []
                }
                else if ( type == STRUCT_START )
                {
                    currentStructName = name
                    ret.structs[ currentStructName ] = []
                }
                else
                    throw Error( `encountered unknown keyword ${type}` )
            }
            else if ( type == ENUM_END && currentEnumName )
                currentEnumName = ""
            else if ( type == STRUCT_END && currentStructName )
                currentStructName = ""
            else
                throw Error( `encountered unknown case with keyword ${type}` )
        }
        // we're in an enum, so enum members
        else if ( currentEnumName )
        {
            if ( !type.match( /^\w+$/ ) )
                throw new Error( `unexpected characters in enum member` )

            // enums only have member names, values are just their index in the enum
            ret.enums[ currentEnumName ].push( type )
        }
        // normal members/struct members
        else
        {
            let name = split[ 1 ]
            if ( !name.match( /^[\w\[\]\{\}]+$/ ) )
                throw new Error( `unexpected characters in member name` )

            // preparse type name for checking
            let checkType = type

            let isNativeArrayType = false
            let isArray = false
            if ( type.includes( '{' ) )
            {
                // native array types are literally only strings, which are defined with string{length}
                checkType = type.substr( 0, type.indexOf( '{' ) )
                isNativeArrayType = true
            }
            else if ( name.includes( '[' ) )
                isArray = true

            // verify type stuff
            if ( !( checkType in NATIVE_TYPES || checkType in ret.structs || checkType in ret.enums ) )
                throw Error( `got unknown type ${checkType}` )
            else
            {
                let arrayLength = -1

                let newMember = { type: checkType, name: name }

                if ( isNativeArrayType )
                {
                    if ( !( checkType in NATIVE_TYPES ) || !NATIVE_TYPES[ checkType ].nativeArrayType )
                        throw Error( `type ${checkType} was accessed like a native array type, while it is not one` )

                    // pretty sure this can't be an enum and has to be a number? unsure
                    newMember.nativeArraySize = parseInt( type.substr( type.indexOf( '{' ) + 1 ) )
                }
                else if ( isArray )
                {
                    let bracketIndex = name.indexOf( '[' )
                    newMember.name = name.substr( 0, bracketIndex )

                    let arraySize = name.substring( bracketIndex + 1, name.indexOf( ']' ) )

                    if ( arraySize in ret.enums )
                        newMember.arraySize = arraySize // just use the enum name here, easier to just let people resolve this themselves
                    else
                        newMember.arraySize = parseInt( arraySize )
                }

                if ( currentStructName )
                    ret.structs[ currentStructName ].push( newMember )
                else
                    ret.members.push( newMember )
            }
        }
    }

    return ret
}

function ParseDefinitionDiff( pdiff )
{
    let ret = {
        enumAdds: {},
        pdefString: "",
        pdef: {}
    }

    let pdefIdx = -1
    let currentEnumAddName
    let lines = pdiff.split( '\n' )

    // read each line
    for ( let i = 0; i < lines.length; i++ )
    {
        // read types/names
        let split = lines[ i ].trim().split( /\s+/g )
        let type = split[ 0 ]

        // check if this is a comment line
        if ( type.includes( "//" ) || type.length == 0 )
            continue

        if ( currentEnumAddName )
        {
            if ( type == ENUM_END )
                currentEnumAddName = ""
            else
            {
                if ( !type.match( /^\w+$/ ) )
                    throw Error( `unexpected characters in enum member` )

                ret.enumAdds[ currentEnumAddName ].push(type)
            }
        }
        else if ( type == PDIFF_ENUM_ADD )
        {
            currentEnumAddName = split[ 1 ]
            if ( !currentEnumAddName.match( /^\w+$/ ) )
                throw Error( `unexpected characters in enum name` )

            ret.enumAdds[ currentEnumAddName ] = []
        }
        else if ( type == PDIFF_PDEF_START )
        {
            pdefIdx = i + 1
            break
        }
        else
            throw Error( `hit unexpected case` )
    }

    if ( pdefIdx != -1 )
    {
        let pdef = lines.slice( pdefIdx ).join( '\n' )
        ret.pdefString = pdef

        ret.pdef = ParseDefinition( pdef )
    }

    return ret
}

function GetMemberSize( member, parsedDef )
{
    let multiplier = 1

    if ( typeof( member.arraySize ) == "string" )
        member.arraySize = parsedDef.enums[ member.arraySize ].length

    multiplier *= member.arraySize || 1

    if ( member.type in NATIVE_TYPES )
    {
        if ( NATIVE_TYPES[ member.type ].nativeArrayType )
            multiplier *= member.nativeArraySize

        return NATIVE_TYPES[ member.type ].size * multiplier
    }
    else if ( member.type in parsedDef.enums )
        return NATIVE_TYPES.int.size * multiplier
    else if ( member.type in parsedDef.structs )
    {
        let structSize = 0
        for ( let structMember of parsedDef.structs[ member.type ] )
            structSize += GetMemberSize( structMember, parsedDef )

        return structSize * multiplier
    }
    else
        throw Error( `got unknown member type ${member.type}` )
}

//function PdataToJson( pdata, pdef )
//{
//    let ret = {}
//    let i = 0
//
//    function recursiveReadPdata( struct, base = "" )
//    {
//        for ( let member of struct )
//        {
//            let arraySize = member.arraySize || 1
//            if ( typeof( arraySize ) == 'string' )
//                arraySize = pdef.enums[ member.arraySize ].length
//
//            for ( let j = 0; j < arraySize; j++ )
//            {
//                let memberName = base + member.name
//
//                if ( member.arraySize )
//                {
//                    memberName += "["
//                    if ( typeof( member.arraySize ) == 'string' )
//                        memberName += pdef.enums[ member.arraySize ][ j ]
//                    else
//                        memberName += j
//
//                    memberName += "]"
//                }
//
//                if ( member.type in NATIVE_TYPES )
//                {
//                    ret[ memberName ] = NATIVE_TYPES[ member.type ].read( pdata, i, member.nativeArraySize )
//                    i += NATIVE_TYPES[ member.type ].size * ( member.nativeArraySize || 1 )
//                }
//                else if ( member.type in pdef.enums )
//                    ret[ memberName ] = pdef.enums[ member.type ][ pdata.readUInt8( i++ ) ] // enums are uint8s
//                else if ( member.type in pdef.structs )
//                    recursiveReadPdata( pdef.structs[ member.type ], memberName + "." )
//            }
//        }
//    }
//
//    recursiveReadPdata( pdef.members )
//
//    return ret
//}

function PdataToJson( pdata, pdef )
{
    let ret = {}
    let i = 0

    function recursiveReadPdata( struct, base )
    {
        for ( let member of struct )
        {
            let arraySize = member.arraySize || 1
            if ( typeof( arraySize ) == 'string' )
                arraySize = pdef.enums[ member.arraySize ].length

            let retArray = []

            for ( let j = 0; j < arraySize; j++ )
            {
                if ( member.type in NATIVE_TYPES )
                {
                    retArray.push( NATIVE_TYPES[ member.type ].read( pdata, i, member.nativeArraySize ) )
                    i += NATIVE_TYPES[ member.type ].size * ( member.nativeArraySize || 1 )
                }
                else if ( member.type in pdef.enums )
                    retArray.push( pdef.enums[ member.type ][ pdata.readUInt8( i++ ) ] ) // enums are uint8s
                else if ( member.type in pdef.structs )
                {
                    let newStruct = {}
                    recursiveReadPdata( pdef.structs[ member.type ], newStruct )
                    retArray.push( newStruct )
                }
            }

            base[ member.name ] = { type: member.type, arraySize: member.arraySize, nativeArraySize: member.nativeArraySize, value: member.arraySize ? retArray : retArray[ 0 ] }
        }
    }

    recursiveReadPdata( pdef.members, ret )

    return ret
}


//function PdataJsonToBuffer( json, pdef )
//{
//    // calc size
//    let size = 0
//    for ( let member of pdef.members )
//        size += GetMemberSize( member, pdef )
//
//    let buf = Buffer.alloc( size )
//
//    let i = 0
//    let currentKey = 0
//    let keys = Object.keys( json )
//
//    function recursiveWritePdata( struct )
//    {
//        for ( let member of struct )
//        {
//            let arraySize = member.arraySize || 1
//            if ( typeof( arraySize ) == 'string' )
//                arraySize = pdef.enums[ arraySize ].length
//
//            for ( let j = 0; j < arraySize; j++ )
//            {
//                if ( member.type in NATIVE_TYPES )
//                {
//                    NATIVE_TYPES[ member.type ].write( buf, json[ keys[ currentKey++ ] ], i, member.nativeArraySize )
//                    i += NATIVE_TYPES[ member.type ].size * ( member.nativeArraySize || 1 )
//                }
//                else if ( member.type in pdef.enums )
//                {
//                    buf.writeUInt8( pdef.enums[ member.type ].indexOf( json[ keys[ currentKey++ ] ] ), i++ ) // enums are uint8s
//                }
//                else if ( member.type in pdef.structs )
//                    recursiveWritePdata( pdef.structs[ member.type ] )
//            }
//        }
//    }
//
//    recursiveWritePdata( pdef.members )
//    return buf
//}

function PdataJsonToBuffer( json, pdef, pdata )
{
    // calc size
    let size = 0
    for ( let member of pdef.members )
        size += GetMemberSize( member, pdef )

    let buf = Buffer.alloc( size )

    let i = 0
    let currentKey = 0
    let keys = Object.keys( json )

    function recursiveWritePdata( struct )
    {
        for ( let memberName in struct )
        {
            let member = struct[ memberName ]

            let arraySize = member.arraySize || 1
            if ( typeof( arraySize ) == 'string' )
                arraySize = pdef.enums[ arraySize ].length

            for ( let j = 0; j < arraySize; j++ )
            {
                let val = member.value
                if ( Array.isArray( val ) )
                    val = member.value[ j ]

                if ( member.type in NATIVE_TYPES )
                {
                    NATIVE_TYPES[ member.type ].write( buf, val, i, member.nativeArraySize )
                    i += NATIVE_TYPES[ member.type ].size * ( member.nativeArraySize || 1 )
                }
                else if ( member.type in pdef.enums )
                {
                    buf.writeUInt8( pdef.enums[ member.type ].indexOf( val ), i++ ) // enums are uint8s
                }
                else if ( member.type in pdef.structs )
                    recursiveWritePdata( val )
            }
        }
    }

    recursiveWritePdata( json )
    return buf
}


module.exports = {
    NATIVE_TYPES: NATIVE_TYPES,

    ParseDefinition: ParseDefinition,
    ParseDefinitionDiff: ParseDefinitionDiff,
    GetMemberSize: GetMemberSize,
    PdataToJson: PdataToJson,
    PdataJsonToBuffer: PdataJsonToBuffer,
}
