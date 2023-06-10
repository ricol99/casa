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
         this.emit(event.eventName, event.data);
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

// Override this to learn of new subscriptions
AsyncEmitter.prototype.subscriptionRegistered = function(_event, _subscription) {
};

module.exports = exports = AsyncEmitter;

