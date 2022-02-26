const errorCodes = {
	ACCOUNT_NOT_FOUND: {
		enum: "ACCOUNT_NOT_FOUND",
		msg: "Account wasn't found",
	},
	PARSING_MODINFO: {
		enum: "PARSING_MOD_INFO",
		msg: "Error parsing modinfo",
	},
	NO_AUTH_RESPONSE: {
		enum: "NO_AUTH_RESPONSE",
		msg: "Couldn't reach auth server",
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
	}
}

module.exports = errorCodes
