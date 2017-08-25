var util = require('util');
var Service = require('../service');
var LightwaveRf = require("lightwaverf");

function LightwaveRfService(_config) {
   Service.call(this, _config);

   this.linkAddress = _config.linkAddress;
   this.queue = [];
   this.requestPending = false;
}

util.inherits(LightwaveRfService, Service);

LightwaveRfService.prototype.coldStart = function() {
   this.lightwaveRf = new LightwaveRf({ ip: this.linkAddress });
};

LightwaveRfService.prototype.turnDeviceOn = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device on, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.lightwaveRf.turnDeviceOn(_params.roomId, _params.deviceId, _cb);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.turnDeviceOff = function(_roomId, _deviceId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device off, roomId: ' + _params.roomId + ', deviceId: ' + _params.deviceId);
      _this.lightwaveRf.turnDeviceOff(_params.roomId, _params.deviceId, _cb);
   }, { roomId: _roomId, deviceId: _deviceId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.setDeviceDim = function(_roomId, _deviceId, _dimLevel, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning device on with dim level, roomId: ' + _params.roomId + ', _deviceId: ' + _params.deviceId + ', dimLevel: ' + _params.dimLevel);
      _this.lightwaveRf.setDeviceDim(_params.roomId, _params.deviceId, _params.dimLevel, _cb);
   }, { roomId: _roomId, deviceId: _deviceId, dimLevel: _dimLevel } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.setRoomMood = function(_roomId, _moodId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': setting room mood, roomId: ' + _params.roomId + ' moodId:' + _params.moodId);
      _this.lightwaveRf.setMood(_params.roomId, _params.moodId, _cb);
   }, { roomId: _roomId, moodId: _moodId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.turnRoomOff = function(_roomId, _callback) {

   this.addToQueue(function(_this, _params, _cb) {
      console.log(_this.uName + ': turning room off, roomId: ' + _params.roomId);
      _this.lightwaveRf.turnRoomOff(_params.roomId, _cb);
   }, { roomId: _roomId } , _callback);

   this.makeNextRequest();
}

LightwaveRfService.prototype.addToQueue = function(_request, _params, _callback) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
}

LightwaveRfService.prototype.makeNextRequest = function() {
   var that = this;

   if ((this.queue.length > 0 && !this.requestPending) {
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

module.exports = exports = LightwaveRfService;
