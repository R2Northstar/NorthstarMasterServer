const crypto = require( "crypto" )

const NATIVE_TYPES = {
	int: { size: 4,
		read: ( buf, idx ) =>
		{
			try
			{
				return buf.readInt32LE( idx )
			}
			catch
			{
				// if we went outside the bounds of the buffer, just assume 0
				// this allows us to add to the end of the pdef without breaking shit, provided we dont care about the value
				return 0
			}
		},
		write: ( buf, value, idx ) => buf.writeInt32LE( value, idx )
	},
	float: { size: 4,
		read: ( buf, idx ) =>
		{
			try
			{
				return buf.readFloatLE( idx )
			}
			catch
			{
				// if we went outside the bounds of the buffer, just assume 0
				// this allows us to add to the end of the pdef without breaking shit, provided we dont care about the value
				return 0
			}
		},
		write: ( buf, value, idx ) => buf.writeFloatLE( Number( value ), idx )
	},
	bool: {
		size: 1,
		read: ( buf, idx ) =>
		{
			try
			{
				return !!buf.readUInt8( idx )
			}
			catch
			{
				// if we went outside the bounds of the buffer, just assume false
				// this allows us to add to the end of the pdef without breaking shit, provided we dont care about the value
				return false
			}
		},
		write: ( buf, value, idx ) => buf.writeUint8( value, idx )
	},
	string: {
		size: 1,
		nativeArrayType: true,
		read: ( buf, idx, length ) =>
		{
			try
			{
				return buf.toString( "ascii", idx, idx + length )
			}
			catch
			{
				// if we went outside the bounds of the buffer, just assume all null chars
				// this allows us to add to the end of the pdef without breaking shit, provided we dont care about the value
				return "\0".repeat( length )
			}
		},
		write: ( buf, value, idx, length ) =>
		{
			buf.write( value.padEnd( length, "\0" ), idx, length, "ascii" )
		}
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
	for ( let line of pdef.split( "\n" ) )
	{
		// read types/names
		let split = line.trim().split( /\s+/g )
		let type = split[ 0 ]

		// check if this is a comment line
		if ( type.includes( "//" ) || type.length == 0 )
			continue

		// user-defined type keywords
		if ( type[ 0 ][ 0 ] == "$" )
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
				throw new Error( "unexpected characters in enum member" )

			// enums only have member names, values are just their index in the enum
			ret.enums[ currentEnumName ].push( type )
		}
		// normal members/struct members
		else
		{
			let name = split[ 1 ]
			if ( !name.match( /^[\w[\]{}]+$/ ) )
				throw new Error( "unexpected characters in member name" )

			// preparse type name for checking
			let checkType = type

			let isNativeArrayType = false
			let isArray = false
			if ( type.includes( "{" ) )
			{
				// native array types are literally only strings, which are defined with string{length}
				checkType = type.substr( 0, type.indexOf( "{" ) )
				isNativeArrayType = true
			}
			if ( name.includes( "[" ) )
				isArray = true

			// verify type stuff
			if ( !( checkType in NATIVE_TYPES || checkType in ret.structs || checkType in ret.enums ) )
				throw Error( `got unknown type ${checkType}` )
			else
			{
				let newMember = { type: checkType, name: name }

				if ( isNativeArrayType )
				{
					if ( !( checkType in NATIVE_TYPES ) || !NATIVE_TYPES[ checkType ].nativeArrayType )
						throw Error( `type ${checkType} was accessed like a native array type, while it is not one` )

					// pretty sure this can't be an enum and has to be a number? unsure
					newMember.nativeArraySize = parseInt( type.substr( type.indexOf( "{" ) + 1 ) )
				}
				if ( isArray )
				{
					let bracketIndex = name.indexOf( "[" )
					newMember.name = name.substr( 0, bracketIndex )

					let arraySize = name.substring( bracketIndex + 1, name.indexOf( "]" ) )

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
	let lines = pdiff.split( "\n" )

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
					throw Error( "unexpected characters in enum member" )

				ret.enumAdds[ currentEnumAddName ].push( type )
			}
		}
		else if ( type == PDIFF_ENUM_ADD )
		{
			currentEnumAddName = split[ 1 ]
			if ( !currentEnumAddName.match( /^\w+$/ ) )
				throw Error( "unexpected characters in enum name" )

			ret.enumAdds[ currentEnumAddName ] = []
		}
		else if ( type == PDIFF_PDEF_START )
		{
			pdefIdx = i + 1
			break
		}
		else
			throw Error( "hit unexpected case: " + type )
	}

	if ( pdefIdx != -1 )
	{
		let pdef = lines.slice( pdefIdx ).join( "\n" )
		ret.pdefString = pdef

		ret.pdef = ParseDefinition( pdef )
	}

	return ret
}

function GetMemberSize( member, parsedDef )
{
	let multiplier = 1
	let arraySize

	// pain and suffering
	if ( typeof( member.arraySize ) == "string" )
	{
		/*console.log( "ENUM NAME: " )
		console.log( member.arraySize )
		console.log( "ENUM LENGTH:" )
		console.log( parsedDef.enums[ member.arraySize ].length )*/
		arraySize = parsedDef.enums[ member.arraySize ].length
	}
	else
	{
		arraySize = member.arraySize
	}

	multiplier *= arraySize || 1

	if ( member.type in NATIVE_TYPES )
	{
		if ( NATIVE_TYPES[ member.type ].nativeArrayType )
			multiplier *= member.nativeArraySize
		return NATIVE_TYPES[ member.type ].size * multiplier
	}
	else if ( member.type in parsedDef.enums )
		return multiplier
	else if ( member.type in parsedDef.structs )
	{
		let structSize = 0
		for ( let structMember of parsedDef.structs[ member.type ] )
			structSize += GetMemberSize( structMember, parsedDef )

		structSize *= multiplier
		return structSize
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
	// calc size
	let size = 0
	for ( let member of pdef.members )
		size += GetMemberSize( member, pdef )

	if ( size != pdata.length )
	{
		console.log( "calculated size does not match pdata length" )
	}

	let ret = {}
	let i = 0

	function recursiveReadPdata( struct, base )
	{
		for ( let member of struct )
		{
			let arraySize = member.arraySize || 1
			if ( typeof( arraySize ) == "string" )
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
					try
					{
						retArray.push( pdef.enums[ member.type ][ pdata.readUInt8( i++ ) ] ) // enums are uint8s
					}
					catch ( ex )
					{
						// if we are out of the bounds of the array we just assume the data is 0
						retArray.push( pdef.enums[ member.type ][ 0 ] )
					}
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

	try
	{
		recursiveReadPdata( pdef.members, ret )
	}
	catch ( ex )
	{
		console.log( ex )
	}

	if ( i != size )
	{
		console.log( "did not reach the end of the pdata" )
	}

	return ret
}

function PdataToJsonUntyped( pdata, pdef )
{
	// calc size
	let size = 0
	for ( let member of pdef.members )
		size += GetMemberSize( member, pdef )

	if ( size != pdata.length )
	{
		console.log( "calculated size does not match pdata length" )
	}
	let ret = {}
	let i = 0

	function recursiveReadPdata( struct, base )
	{
		for ( let member of struct )
		{
			let arraySize = member.arraySize || 1
			if ( typeof( arraySize ) == "string" )
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
					try
					{
						retArray.push( pdef.enums[ member.type ][ pdata.readUInt8( i++ ) ] ) // enums are uint8s
					}
					catch ( ex )
					{
						// if we are out of the bounds of the array we just assume the data is 0
						retArray.push( pdef.enums[ member.type ][ 0 ] )
					}
				else if ( member.type in pdef.structs )
				{
					let newStruct = {}
					recursiveReadPdata( pdef.structs[ member.type ], newStruct )
					retArray.push( newStruct )
				}
			}

			base[ member.name ] = member.arraySize ? retArray : retArray[ 0 ]
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

function PdataJsonToBuffer( json, pdef )
{
	// calc size
	let size = 0
	for ( let member of pdef.members )
		size += GetMemberSize( member, pdef )
	let buf = Buffer.alloc( size )

	let i = 0
	// let currentKey = 0
	// let keys = Object.keys( json )


	function recursiveWritePdata( struct )
	{
		for ( let memberName in struct )
		{
			let member = struct[ memberName ]

			let arraySize = member.arraySize || 1
			if ( typeof( arraySize ) == "string" )
				arraySize = pdef.enums[ arraySize ].length

			for ( let j = 0; j < arraySize; j++ )
			{
				let val = member.value
				if ( typeof( val ) == "undefined" )
				{
					val = "NULL"
				}
				if ( Number.isNaN( val ) )
					console.log( val )
				if ( Array.isArray( val ) )
					val = member.value[ j ]

				if ( member.type in NATIVE_TYPES )
				{
					NATIVE_TYPES[ member.type ].write( buf, val, i, member.nativeArraySize )
					i += NATIVE_TYPES[ member.type ].size * ( member.nativeArraySize || 1 )
				}
				else if ( member.type in pdef.enums )
				{
					if ( pdef.enums[ member.type ].indexOf( val ) == -1 )
					{
						console.log( "not found in enum" )
						buf.writeUInt8( 0, i++ )
					}
					else
					{
						buf.writeUInt8( pdef.enums[ member.type ].indexOf( val ), i++ ) // enums are uint8s
					}
				}
				else if ( member.type in pdef.structs )
				{
					recursiveWritePdata( val )
				}
			}
			// debug for when readhead has moved a weird amount
			/*if ( i - oldi != GetMemberSize( member, pdef ) )
			{
				console.log( member )
				console.log( "readhead moved: " + ( i - oldi ) )
				console.log( "expected distance moved: " + GetMemberSize( member, pdef ) )
			//}*/

			//console.log( "written " + ( i - oldi ) + " bytes for member " + memberName )
		}
	}

	try
	{
		recursiveWritePdata( json )
	}
	catch ( ex )
	{
		console.log( ex )
	}
	// ideally these should be identical
	return buf
}


module.exports = {
	NATIVE_TYPES: NATIVE_TYPES,

	ParseDefinition: ParseDefinition,
	ParseDefinitionDiff: ParseDefinitionDiff,
	GetMemberSize: GetMemberSize,
	PdataToJson: PdataToJson,
	PdataToJsonUntyped: PdataToJsonUntyped,
	PdataJsonToBuffer: PdataJsonToBuffer,

	ParseModPDiffs: async function ( request )
	{
		let modInfo

		if ( request.isMultipart() )
		{
			try
			{
				modInfo = JSON.parse( ( await ( await request.file() ).toBuffer() ).toString() )
				modInfo.Mods.sort( ( a, b ) =>
				{
					if ( a.LoadPriority > b.LoadPriority )
					{
						return 1
					}
					else if ( a.LoadPriority < b.LoadPriority )
					{
						return -1
					}
					else
					{
						return 1
					}
				} )
			}
			catch ( ex )
			{
				console.log( ex )
				return
			}
		}
		else
		{
			// console.log( request ) isnt particularly helpful so im just gonna return
			return
		}

		// pdiff stuff
		if ( modInfo && modInfo.Mods )
		{
			for ( let mod of modInfo.Mods )
			{
				if ( mod.pdiff )
				{
					try
					{
						let pdiffHash = crypto.createHash( "sha1" ).update( mod.pdiff ).digest( "hex" )
						mod.pdiff = module.exports.ParseDefinitionDiff( mod.pdiff )
						mod.pdiff.hash = pdiffHash
					}
					catch ( ex )
					{
						mod.pdiff = null
					}
				}
			}
		}

		return modInfo
	}
}
