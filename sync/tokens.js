const crypto = require('crypto');

let tokens = {}

function getOwnToken() {
    return new Promise(async (resolve, reject) => {
        if(tokens.hasOwnProperty(process.env.DATASYNC_OWN_ID)) resolve(tokens[process.env.DATASYNC_OWN_ID])
        else reject()
    });
}
function getInstanceToken(id) {
    return new Promise(async (resolve, reject) => {
        if(tokens.hasOwnProperty(id)) resolve(tokens[id])
        else reject()
    });
}
function getAllTokens() {
    return tokens;
}
function resetTokens() {
    tokens = {}
}
function bulkSetTokens(newTokens) {
    tokens = Object.assign(tokens, newTokens);
}
function setToken(id, token) {
    if(!tokens.hasOwnProperty(id)) tokens[id] = token
}
function removeToken(id) {
    if(tokens.hasOwnProperty(id)) delete tokens[id]
}
function hasToken(id) {
    return tokens.hasOwnProperty(id)
}
function generateToken() {
    return crypto.randomBytes(process.env.DATASYNC_TOKEN_BYTES || 256).toString('base64');
}
module.exports = {
    getOwnToken,
    getInstanceToken,
    getAllTokens,
    resetTokens,
    bulkSetTokens,
    setToken,
    removeToken,
    hasToken,
    generateToken
}