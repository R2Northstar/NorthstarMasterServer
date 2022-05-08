///// Credit to R5Reloaded for the following code /////

/// Netmessages ///
const BitBuffer = require( "bit-buffer" )

const R5Messages = {
	a2s_getchallenge: function( uid )
	{
		let buf = Buffer.alloc( 1600 )
		let stream = new BitBuffer.BitStream( buf )

		stream.writeInt32( -1 )
		stream.writeUint8( "H".charCodeAt( 0 ) )
		stream.writeASCIIString( "connect" )

		stream.writeUint32( Number( uid & 0xffffffffn ) )
		stream.writeUint32( Number( uid >> 32n ) )

		stream.writeUint8( 2 )

		const ret = stream.buffer.slice( stream.buffer.byteOffset, stream.byteIndex ) // ???
		return ret
	}
}
/// Netmessages END ///

/// Crypto ///
const crypto = require( "crypto" )

class rSrcNetCrypto
{
	constructor( key )
	{
		this.key = Buffer.from( key, "base64" )
		this.aad = Buffer.from(
			"\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f\x10",
			"ascii"
		)
		//this.iv = Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaa", "hex")
	}

	encrypt( data, bytes = -1 )
	{
		this.iv = crypto.randomBytes( 12 )

		let cipher = crypto.createCipheriv( "aes-128-gcm", this.key, this.iv )
		cipher.setAAD( this.aad )

		let encrypted = Buffer.concat( [
			cipher.update( data.slice( 0, bytes > 0 ? bytes : data.length ) ),
			cipher.final(),
		] )

		let tag = cipher.getAuthTag()

		const ret = Buffer.concat( [this.iv, tag, encrypted] )

		return ret
	}

	decrypt( packet_data )
	{
		let iv = packet_data.slice( 0, 12 )
		let tag = packet_data.slice( 12, 16 )
		let data = packet_data.slice( 12 + 16, packet_data.length )

		let decipher = crypto.createDecipheriv( "aes-128-gcm", this.key, iv )

		decipher.setAAD( this.aad )
		decipher.setAuthTag( tag )

		try
		{
			return Buffer.concat( [decipher.update( data ), decipher.final()] )
		}
		catch ( e )
		{
			return Buffer.from( "000000000000000000000000" )
		}
	}
}
/// Crypto END ///

/// Networking ///
const dgram = require( "dgram" )
const { EventEmitter } = require( "stream" )

class rSrcNetClient
{
	constructor( owner )
	{
		this._owner = owner
	}

	onMessage( msg, rinfo )
	{
		if ( rinfo.address != this.ip || rinfo.port != this.port )
		{
			//console.log("Mismatch?", rinfo)
			return
		}

		const decryptedData = this._owner.crypto.decrypt( msg )
		this._owner.emit( "data", decryptedData )
	}

	send( data, bytes = -1 )
	{
		const enc = this._owner.crypto.encrypt( data, bytes )
		this.socket.send( enc, this.port, this.ip )
	}

	connect( ip, port )
	{
		this.ip = ip
		this.port = port
		this.socket = dgram.createSocket( {
			type: "udp4",
			reuseAddr: false,
		} )

		const data = R5Messages.a2s_getchallenge( this._owner.connectionSettings.uid )
		const enc = this._owner.crypto.encrypt( data )

		this.socket.bind(
			{
				port: 0,
				exclusive: true,
				//exclusive: false,
			},
			() =>
			{
				this.bindPort = this.socket.address().port
				this.socket.send( enc, this.port, this.ip )
			}
		)

		this.socket.on( "message", this.onMessage.bind( this ) )
	}

	close()
	{
		this.socket.close()
	}
}
/// Networking END ///

/// Main client class ///
class rSrcClient extends EventEmitter
{
	constructor( constgs )
	{
		super()

		this.connectionSettings = constgs

		this.crypto = new rSrcNetCrypto( this.connectionSettings.encryptionKey )
		this.net = new rSrcNetClient( this )

		this.on( "data", this.onData.bind( this ) )
	}

	connect()
	{
		this.net.connect( this.connectionSettings.ip, this.connectionSettings.port )
	}

	onData( data )
	{
		if ( data.readInt32LE() != -1 )
			return // not connectionless

		if ( data.readUint8( 4 ) != 73 )
			return // not challenge response

		if ( data.readBigInt64LE( 9 ) != this.connectionSettings.uid )
			return // challenge not for this uid

		const challenge = data.readInt32LE( 5 )
		this.emit( "challenge", challenge )

		this.net.close()
	}

	close()
	{
		this.net.close()
	}
}
/// Main client class END ///

module.exports = rSrcClient
