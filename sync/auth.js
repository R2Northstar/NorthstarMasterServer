// Auth.js is the file responsible for authenticating a new node to a network
// For more information on the authentication protocol, see auth.md in the root directory of the project

const crypto = require("crypto")
const fs = require("fs")
const { broadcastEvent, startSync, connectTo } = require("./broadcast")
const { encryptPayload, decryptPayload } = require("./encryption")

const { getInstanceById } = require("./instances.js")
const { logSync } = require("../logging.js")

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
            // acceptRequest is hardcoded true, keeping it anyway for possible later use
            replyFunc("serverJoinChallenge", {challenge: encrypt(secret, publicKey), acceptRequest:true})
        }
        catch (e) {
            logSync(e.toString(), 1, type="error")
        }
    },
    serverJoinChallenge: async (data, replyFunc) => { // Received by Client from Master
        try {
            let { challenge, acceptRequest } = data.data
            if (acceptRequest) {
                replyFunc("serverJoinChallengeAttempt", {response: decrypt(challenge, privateKey), id: process.env.DATASYNC_OWN_ID})
            }
            else {
                logSync("acceptRequest is false, not allowed to connect. Dying", 0, "error")
                process.exit(1)
            }
        }
        catch (e) {
            logSync(e.toString(), 1, type="error")
        }
    },

    serverJoinChallengeAttempt: async (data, replyFunc) => { // Received by Master from Client
        try {
            let { response, id } = data.data
            let correct = data.buffer.checkSecret(response, id) && !hasNetworkNode(id)
            let token;
            if (correct) {
                logSync("Authorisation request from " + id + " was correct, authorizing!", 2)
                token = generateToken();
                addNetworkNode(id, token)
                broadcastEvent("addNetworkNode", {id, token})
                logSync("Updated network! Current network: " + Object.keys(await getNetworkNodes()), 2)
            }
            else {
                logSync("Authorisation request from " + id + " was incorrect, denying!", 2, type="warn")
            }
            let encNet = await encryptPayload(JSON.stringify(getNetworkNodes()), token)
            replyFunc("serverJoinChallengeResponse", { correct, token: (correct ? encrypt(token, publicKey) : undefined), network: (correct ? encNet : undefined) })
        }
        catch (e) {
            logSync(e.toString(), 1, type="error")
        }
    },

    serverJoinChallengeResponse: async (data, replyFunc, socket) => { // Received by Client from Master
        try {
            let { correct, token } = data.data
            if (correct) {
                logSync("Authorisation was correct, authorized!", 2)
                let tokenDecrypted = decrypt(token, privateKey);

                let decNetwork = await decryptPayload(data.data.network, tokenDecrypted)
                setNetworkNodes(JSON.parse(decNetwork.data))
                logSync("Received network data from master", 2)
                for (let node of Object.values( await getNetworkNodes())) {
                    if (node.id != process.env.DATASYNC_OWN_ID && node.id != socket.id) {
                        connectTo(await getInstanceById(node.id))
                    }
                }

                startSync();
            }
            else {
                logSync("Authorisation was incorrect, unauthorized! Dying.", 0, "error")
                process.exit(1)
            }
        }
        catch (e) {
            logSync(e.toString(), 1, type="error")
        }
    },
}