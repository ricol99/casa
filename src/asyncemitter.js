var util = require('./util');
var events = require('events');

var _suspensionAvailable = true;

function AsyncEmitter() {
   this.eventQueue = [];

   events.EventEmitter.call(this);
}

util.inherits(AsyncEmitter, events.EventEmitter);

AsyncEmitter.suspensionAvailable = function() {
   return _suspensionAvailable;
};

// Called when current state required
AsyncEmitter.prototype.export = function(_exportObj) {

   if (this.eventQueue.length > 0) {
      _exportObj.asyncEventQueue = this.eventQueue;
   }
};

// Called when current state required
AsyncEmitter.prototype.import = function(_importObj) {

   if (_importObj.hasOwnProperty("asyncEventQueue")) {
      this.eventQueue = util.copy(_importObj.asyncEventQueue);
   }
};

AsyncEmitter.prototype.coldStart = function() {
};

AsyncEmitter.prototype.hotStart = function() {

   if (this.eventQueue.length > 0) {
      this.setAsyncEmitTimer();
   }
};

AsyncEmitter.prototype.asyncEmit = function(_eventName, _data) {
   this.eventQueue.push({ eventName: _eventName, data: util.copy(_data)});
   this.setAsyncEmitTimer();
};

AsyncEmitter.prototype.setAsyncEmitTimer = function() {

   if (!this.asyncEmitTimer) {

      this.asyncEmitTimer = setTimeout( () => {
         let event = this.eventQueue.shift();

         // Do not attempt a suspension/restore cycle if in casa code and exception raised
         _suspensionAvailable = false;
         AsyncEmitter.prototype.emit.call(this, event.eventName, event.data);
         _suspensionAvailable = true;

         this.asyncEmitTimer = null;

         if (this.eventQueue.length >= 1) {
            this.setAsyncEmitTimer();
         }
      }, 1);
   }
};

AsyncEmitter.prototype.on = function(_event, _callback, _subscription) {

   if (_subscription) {
      console.log(this.uName+": Somebody asked to listen to event "+_subscription.property);
      this.subscriptionRegistered(_event, _subscription);
   }

   return events.EventEmitter.prototype.on.call(this, _event,  _callback);
};

AsyncEmitter.prototype.removeListener = function(_event, _handler, _subscription) {

   if (_subscription) {
      console.log(this.uName+": Somebody asked to remove a subscription "+_subscription.property);
      this.subscriptionRemoval(_event, _subscription)
   }

   return events.EventEmitter.prototype.removeListener.call(this, _event, _handler);
}

// Override this to learn of new subscriptions
AsyncEmitter.prototype.subscriptionRegistered = function(_event, _subscription) {
};

// Override this to learn of subscription removal
AsyncEmitter.prototype.subscriptionRemoval = function(_event, _subscription) {
};

module.exports = exports = AsyncEmitter;

