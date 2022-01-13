const EventEmitter = require('events');

class WSBroadcastEmitter extends EventEmitter {}

const emitter = new WSBroadcastEmitter();

module.exports = {
    emitter,
    broadcastEvent: function(event, payload) {
        emitter.emit('event', { event, payload })
    }
}
