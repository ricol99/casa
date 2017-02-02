var util = require('util');
var Thing = require('./thing');
var LightwaveRf = require("lightwaverf");

function LightwaveRfLink(_config) {

   Thing.call(this, _config);

   this.thingType = 'lightwave-controller';
   this.lightwaveRf = new LightwaveRf({ ip: this.getProperty('ipAddress') });
   this.queue = [];
   this.requestPending = false;
}

util.inherits(LightwaveRfLink, Thing);

LightwaveRfLink.prototype.turnDeviceOn = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.lightwaveRf.turnDeviceOn(_params.roomId, _params.deviceId, _callback);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.turnDeviceOff = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device off, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.lightwaveRf.turnDeviceOff(_params.roomId, _params.deviceId, _callback);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.setDeviceDim = function(_roomId, _deviceId, _dimLevel, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on with dim level, roomId: ' + _params.roomId + ', _deviceId: ' + _params.deviceId + ', dimLevel: ' + _params.dimLevel);
      _this.lightwaveRf.setDeviceDim(_params.roomId, _params.deviceId, _params.dimLevel, _callback);
   }, { roomId: _roomId, deviceId: _deviceId, dimLevel: _dimLevel } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.setRoomMood = function(_roomId, _moodId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': setting room mood, roomId: ' + _params.roomId + ' moodId:' + _params.moodId);
      _this.lightwaveRf.setMood(_params.roomId, _params.moodId, _callback);
   }, { roomId: _roomId, moodId: _moodId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.turnRoomOff = function(_roomId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning room off, roomId: ' + _params.roomId);
      _this.lightwaveRf.turnRoomOff(_params.roomId, _callback);
   }, { roomId: _roomId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

LightwaveRfLink.prototype.addToQueue = function(_request, _params, _callback) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
}

LightwaveRfLink.prototype.makeNextRequest = function() {
   var that = this;

   if (this.queue.length > 0) {
      this.requestPending = true;

      this.queue[0].request(this, this.queue[0].params, function(_error, _content) {
         console.log(that.uName + ': Request done!');
         that.queue.shift().callback(_error, _content);

         if (that.queue.length > 0) {

            // More in the queue, so reschedule after the link has had time to settle down
            var delay = setTimeout(function(_this) {
               _this.requestPending = false;
               _this.makeNextRequest();
            }, 750, that);
         }
         else {
            that.requestPending = false;
         }
      });
   }
}

module.exports = exports = LightwaveRfLink;
