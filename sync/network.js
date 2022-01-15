let network = {}

function addNetworkNode(id, token) {
    network[id] = {id, token}
}

function getNetworkNode(id) {
    return network[id]
}

function removeNetworkNode(id) {
    if (network[id] != undefined) {
        delete network[id]
    }
}

function getNetworkNodes() {
    return network
}

function setNetworkNodes(recvNodes) {
    network = recvNodes
}

module.exports = {
    addNetworkNode,
    getNetworkNode,
    removeNetworkNode,
    getNetworkNodes,
    setNetworkNodes
}