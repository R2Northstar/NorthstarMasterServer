let syncState = 0;
function getSyncState() {
    return syncState;
}
function setSyncState(state) {
    syncState = state;
}

module.exports = {
    getSyncState,
    setSyncState
}