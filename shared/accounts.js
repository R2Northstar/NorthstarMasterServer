const sqlite = require( "sqlite3" ).verbose()
let playerDB = new sqlite.Database( 'db/temp_pdata.db', sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE, ex => { 
	if ( ex )
		console.error( ex )
	else
		console.log( "Connected to temporary persistent data database successfully" )
	
	// create table
	// this should mirror the PlayerAccount class's	properties
	playerDB.run( `
	CREATE TABLE IF NOT EXISTS accounts (
		id TEXT PRIMARY KEY,
		persistentData BLOB
	 )
	`, ex => {
		if ( ex )
			console.error( ex )
		else
			console.log( "Created player account table successfully" )
	})
})

function asyncDBGet( sql, params = [] )
{
	return new Promise( ( resolve, reject ) => {
		playerDB.get( sql, params, ( ex, row ) => {
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			else 
			{
				resolve( row )
			}
		})
	})
}

function asyncDBRun( sql, params = [] )
{
	return new Promise( ( resolve, reject ) => {
		playerDB.run( sql, params, ex => {
			if ( ex )
			{
				console.error( "Encountered error querying player database: " + ex )
				reject( ex )
			}
			
			resolve()
		})
	})
}

class PlayerAccount
{
	// this will be updated later when more account stuff is done, super simple for now tho
	// todo: in the future, this needs an account token string and either the time it was last generated, or a hash of the ip it was last used from
	// should probably also include the server they're currently authenticated with
	
	// string id
	// Buffer persistentData
	
	constructor ( id, persistentData )
	{
		this.id = id
		this.persistentData = persistentData
	}
}

// temp
const fs = require( "fs" )

module.exports = {
	AsyncGetPlayerByID: async function ( id ) {
		let row = await asyncDBGet( "SELECT id, persistentData FROM accounts WHERE id = ?", [ id ] )
		
		if ( !row )
			return null
		
		return new PlayerAccount( row.id, row.persistentData )
	},
	
	AsyncCreateAccountForID: async function ( id ) {
		let pdata = fs.readFileSync( "pdata/default.pdata" )
		await asyncDBRun( "INSERT INTO accounts (id, persistentData) VALUES (?,?)", [ id, pdata ] )
	},
	
	AsyncWritePlayerPersistence: async function ( id, persistentData ) {
		await asyncDBRun( "UPDATE accounts SET persistentData = ? WHERE id = ?", [ persistentData, id ] )
	}
}