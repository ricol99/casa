var util = require('util');
var Thing = require('./thing');
var LightwaveRF = require("lightwaverf");

function LightwaveRfLink(_config) {

   Thing.call(this, _config);

   this.lightwaveRf = new LightwaveRF({ ip: this.getProperty('ipAddress') });
   this.queue = [];
   this.requestPending = false;
   var that = this;
}

util.inherits(LightwaveRfLink, Thing);

LightwaveRfLink.prototype.turnDeviceOn = function(_roomId, _deviceId, _callback) {
   var that = this;

   this.addToQueue(function(_params, _callback) {
      console.log(that.name + ': turning device on, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      that.lightwaveRf.turnDeviceOn(_params.roomId, _params.deviceId, _callback);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.turnDeviceOff = function(_roomId, _deviceId, _callback) {
   var that = this;

   this.addToQueue(function(_params, _callback) {
      console.log(that.name + ': turning device off, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      that.lightwaveRf.turnDeviceOff(_params.roomId, _params.deviceId, _callback);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.setDeviceDim = function(_roomId, _deviceId, _dimLevel, _callback) {
   var that = this;

   this.addToQueue(function(_params, _callback) {
      console.log(that.name + ': turning device on with dim level, roomId: ' + _params.roomId + ', _deviceId: ' + _params.deviceId + ', dimLevel: ' + _params.dimLevel);
      that.lightwaveRf.setDeviceDim(_params.roomId, _params.deviceId, _params.dimLevel, _callback);
   }, { roomId: _roomId, deviceId: _deviceId, dimLevel: _dimLevel } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.setRoomMood = function(_roomId, _moodId, _callback) {
   var that = this;

   this.addToQueue(function(_params, _callback) {
      console.log(that.name + ': setting room mood, roomId: ' + _params.roomId + ' moodId:' + _params.moodId);
      that.lightwaveRf.setMood(_params.roomId, _params.moodId, _callback);
   }, { roomId: _roomId, moodId: _moodId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.turnRoomOff = function(_roomId, _callback) {
   var that = this;

   this.addToQueue(function(_params, _callback) {
      console.log(that.name + ': turning room off, roomId: ' + _params.roomId);
      that.lightwaveRf.turnRoomOff(_params.roomId, _callback);
   }, { roomId: _roomId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.addToQueue = function(_request, _params, _callback) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
}

LightwaveRfLink.prototype.shiftQueue = function() {
   return this.queue.shift();
}

LightwaveRfLink.prototype.scheduleNextRequest = function() {
   var that = this;

   var delay = setTimeout(function() {
      that.makeNextRequest();
   }, 400);
}

LightwaveRfLink.prototype.makeNextRequest = function() {
   var that = this;

   if (this.queue.length > 0) {
      this.requestPending = true;

      this.timeout = setTimeout(function() {
         console.log(that.name + ': Request timed out!');
         that.requestPending = false;
         that.shiftQueue().callback({ message: "Request Timed Out" });
         that.scheduleNextRequest();
      }, 5000);

      this.queue[0].request(this.queue[0].params, function(_error, _content) {
         clearTimeout(that.timeout);
         console.log(that.name + ': Request done!');
         that.requestPending = false;
         that.shiftQueue().callback(_error, _content);
         that.scheduleNextRequest();
      });
   }
}

module.exports = exports = LightwaveRfLink;
