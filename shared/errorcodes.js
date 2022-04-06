const errorCodes = {
	NO_GAMESERVER_RESPONSE: {
		enum: "NO_GAMESERVER_RESPONSE",
		msg: "Couldn't reach game server",
	},
	BAD_GAMESERVER_RESPONSE: {
		enum: "BAD_GAMESERVER_RESPONSE",
		msg: "Game server gave an invalid response",
	},
	UNAUTHORIZED_GAMESERVER: {
		enum: "UNAUTHORIZED_GAMESERVER",
		msg: "Game server is not authorized to make that request",
	},
	UNAUTHORIZED_GAME: {
		enum: "UNAUTHORIZED_GAME",
		msg: "Stryder couldn't confirm that this account owns Titanfall 2",
	},
	UNAUTHORIZED_PWD: {
		enum: "UNAUTHORIZED_PWD",
		msg: "Wrong password",
	},
	STRYDER_RESPONSE: {
		enum: "STRYDER_RESPONSE",
		msg: "Couldn't parse stryder response",
	},
	PLAYER_NOT_FOUND: {
		enum: "PLAYER_NOT_FOUND",
		msg: "Couldn't find player account"
	},
	INVALID_MASTERSERVER_TOKEN: {
		enum: "INVALID_MASTERSERVER_TOKEN",
		msg: "Invalid or expired masterserver token"
	},
	JSON_PARSE_ERROR: {
		enum: "JSON_PARSE_ERROR",
		msg: "Error parsing json response"
	},
	UNSUPPORTED_VERSION: {
		enum: "UNSUPPORTED_VERSION",
		msg: "The version you are using is no longer supported"
	}
}

module.exports = errorCodes
