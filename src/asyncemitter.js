var util = require('./util');
var events = require('events');

function AsyncEmitter() {
   this.eventQueue = [];

   events.EventEmitter.call(this);
}

util.inherits(AsyncEmitter, events.EventEmitter);

AsyncEmitter.prototype.asyncEmit = function(_eventName, _data) {
   this.eventQueue.push({ eventName: _eventName, data: util.copy(_data)});
   this.setAsyncEmitTimer();
};

AsyncEmitter.prototype.setAsyncEmitTimer = function() {

   if (!this.asyncEmitTimer) {

      this.asyncEmitTimer = setTimeout( () => {
         let event = this.eventQueue.pop();
         this.emit(event.eventName, event.data);
         this.asyncEmitTimer = null;

         if (this.eventQueue.length >= 1) {
            this.setAsyncEmitTimer();
         }
      }, 1);
   }
};

AsyncEmitter.prototype.on = function(_event, _subscriptionOrCallback, _callback) {
   var callback = _callback;

   if (_subscriptionOrCallback instanceof Function) {
       callback = _subscriptionOrCallback;
   }
   else  {
      this.subscriptionRegistered(_event, _subscriptionOrCallback);
   }

   return events.EventEmitter.prototype.on.call(this, _event,  callback);
};

// Override this to learn of new subscriptions
AsyncEmitter.prototype.subscriptionRegistered = function(_event, _subscription) {
};

module.exports = exports = AsyncEmitter;

