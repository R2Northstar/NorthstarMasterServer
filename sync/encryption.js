const crypto = require('crypto')
const { getOwnToken } = require('./tokens.js')

// encrypts payloads
async function encryptPayload(body, token) {
    try {
        if(!token) token = await getOwnToken()

        let timestamp = body.lastModified || Date.now()

        const algorithm = process.env.ENCRYPT_ALGO || "aes-256-cbc"; 

        const initVector = crypto.randomBytes(16);
        const Securitykey = crypto.scryptSync(token, 'salt', 32);
        
        const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
        let encryptedData = cipher.update(JSON.stringify({ token, data: body, timestamp }), "utf-8", "hex");
        encryptedData += cipher.final("hex");

        return { iv: initVector, data: encryptedData.toString() }
    } catch(e) {
        console.log(e)
        return {} // don't ever error cause i'm nice
    }
}
// decrypts encrypted payloads
async function decryptPayload(body, token) {
    try {
        if(!token) token = await getOwnToken()

        const encryptedData = body.data;
        const initVector = body.iv;

        const algorithm = process.env.ENCRYPT_ALGO || "aes-256-cbc"; 
        const Securitykey = crypto.scryptSync(token, 'salt', 32);

        const decipher = crypto.createDecipheriv(algorithm, Securitykey, Buffer.from(initVector));
        let decryptedData = decipher.update(encryptedData, "hex", "utf-8");
        decryptedData += decipher.final("utf8");
        let json = JSON.parse(decryptedData);
        return json
    } catch(e) {
        console.log(e)
        return {} // don't ever error cause i'm nice
    }
}

module.exports = {
    encryptPayload,
    decryptPayload
}