// Network.js holds data about the network the node is in

const crypto = require('crypto');
const { getInstanceById } = require('./instances.js');

let network = {}

async function addNetworkNode(id, token) {
    try {
        network[id] = Object.assign({}, getInstanceById(id), {id, token});
    } catch(e) {
        network[id] = {id, token};
    }
}

function getNetworkNode(id) {
    return network[id]
}

function removeNetworkNode(id) {
    if (network[id] != undefined) {
        delete network[id]
    }
}

function hasNetworkNode(id) {
    return network[id] != undefined
}

function getNetworkNodes() {
    return network
}

function setNetworkNodes(recvNodes) {
    network = recvNodes
}

function getOwnToken() {
    return network[process.env.DATASYNC_OWN_ID].token
}
function getInstanceToken(id) {
    if (network[id] != undefined) {
        return network[id].token
    } else {
        return ''
    }
}
function generateToken() {
    return crypto.randomBytes(process.env.DATASYNC_TOKEN_BYTES || 256).toString('base64');
}

module.exports = {
    addNetworkNode,
    getNetworkNode,
    removeNetworkNode,
    hasNetworkNode,
    getNetworkNodes,
    setNetworkNodes,
    getOwnToken,
    getInstanceToken,
    generateToken
}