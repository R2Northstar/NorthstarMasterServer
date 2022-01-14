const { GameServer, GetGameServers, AddGameServer, RemoveGameServer, UpdateGameServer } = require("../shared/gameserver.js")
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

let publicKey = fs.readFileSync("./rsa_4096_pub.pem").toString()
let privateKey = fs.readFileSync("./rsa_4096_priv.pem").toString()

function encrypt(toEncrypt, publicKey) {
    const buffer = Buffer.from(toEncrypt, 'utf8')
    const encrypted = crypto.publicEncrypt(publicKey, buffer)
    return encrypted.toString('base64')
}

function decrypt(toDecrypt, privateKey) {
    const buffer = Buffer.from(toDecrypt, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: '',
      },
      buffer,
    )
    return decrypted.toString('utf8')
}

module.exports = {
    // eventName: async (data) => {
    //     try { 
    //         EVENT HANDLER
    //     } catch(e) {
    //         if(process.env.USE_DATASYNC_LOGGING) console.log(e)
    //     }
    // }
    serverRequestJoin: async (data, replyFunc) => {
        try { 
            let { id, buffer } = data;
            let secret = buffer.generateSecret(id)
            replyFunc("serverJoinChallenge", {challenge: encrypt(secret, publicKey), acceptRequest:true})
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },
    serverJoinChallenge: async (data, replyFunc) => {
        try {
            let { challenge, acceptRequest } = data.data
            if (acceptRequest) {
                // TODO: prevent mitm here, provided we arent using ssl
                replyFunc("serverJoinChallengeAttempt", {response: decrypt(challenge, privateKey), id: process.env.DATASYNC_OWN_ID})
            }
            else {
                console.log("NOT ALLOWED TO CONNECT")
            }
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },

    serverJoinChallengeAttempt: async (data, replyFunc) => {
        try {
            let { response, id } = data.data
            let correct = data.buffer.checkSecret(response, id)
            if (correct) {
                console.log("Authorisation request from " + id + " was correct, authorizing!")
            }
            else {
                console.log("Authorisation request from " + id + " was incorrect, denying!")
            }
            replyFunc("serverJoinChallengeResponse", {correct: correct})
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },

    serverJoinChallengeResponse: async (data, replyFunc) => {
        try {
            let { correct } = data.data
            if (correct) {
                console.log("Authorisation request from " + id + " was correct, authorizing!")
            }
            else {
                console.log("Authorisation request from " + id + " was incorrect, denying!")
            }
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    }
}