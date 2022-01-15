const crypto = require("crypto")
const fs = require("fs")
const { broadcastEvent, startSync } = require("./broadcast")
const { encryptPayload, decryptPayload } = require("./encryption")

const { addNetworkNode, getNetworkNodes, setNetworkNodes, generateToken, hasNetworkNode } = require("./network")

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

// Terminology for the auth process:
// Client = new master server requesting to join network
// Master = master server in network handling the join request
// Network = the network including the master

module.exports = {
    // eventName: async (data) => {
    //     try { 
    //         EVENT HANDLER
    //     } catch(e) {
    //         if(process.env.USE_DATASYNC_LOGGING) console.log(e)
    //     }
    // }
    

    serverRequestJoin: async (data, replyFunc) => { // Received by Master from Client
        try { 
            let { id, buffer } = data;
            let secret = buffer.generateSecret(id)
            replyFunc("serverJoinChallenge", {challenge: encrypt(secret, publicKey), acceptRequest:true})
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },
    serverJoinChallenge: async (data, replyFunc) => { // Received by Client from Master
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

    serverJoinChallengeAttempt: async (data, replyFunc) => { // Received by Master from Client
        try {
            let { response, id } = data.data
            let correct = data.buffer.checkSecret(response, id) && !hasNetworkNode(id)
            let token;
            let encryptedToken;
            if (correct) {
                console.log("Authorisation request from " + id + " was correct, authorizing!")
                token = generateToken();
                encryptedToken = encrypt(token, publicKey); // Send new master server token to network
                // console.log(token)
                // console.log(id)
                addNetworkNode(id, token)
                // console.log(getNetworkNodes())
            }
            else {
                console.log("Authorisation request from " + id + " was incorrect, denying!")
            }
            // console.log("Encrypting with token " + token)
            let encNet = await encryptPayload(JSON.stringify(getNetworkNodes()), token)
            // console.log(encNet)
            replyFunc("serverJoinChallengeResponse", { correct, token: (correct ? encrypt(token, publicKey) : undefined), network: (correct ? encNet : undefined) })
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },

    serverJoinChallengeResponse: async (data) => { // Received by Client from Master
        try {
            let { correct, token, id, network } = data.data
            // console.log(data.data)
            // console.log(data.data.network.data)
            if (correct) {
                console.log("Authorisation was correct, authorized!")
                tokenDecrypted = decrypt(token, privateKey);

                let decNetwork = await decryptPayload(data.data.network, tokenDecrypted)
                // console.log("Network is " + JSON.stringify(decNetwork.data))
                setNetworkNodes(JSON.parse(decNetwork.data))
                console.log("Received network data from master")

                startSync();
            }
            else {
                console.log("Authorisation was incorrect, unauthorized!")
            }
        }
        catch (e) {
            if(process.env.USE_AUTH_LOGGING) console.log(e)
        }
    },
}