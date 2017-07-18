var util = require('util');
var Service = require('../service');
var Hue = require("node-hue-api").HueApi;

function HueService(_config) {
   Service.call(this, _config);

   this.linkAddress = _config.linkAddress;
   this.username = _config.username;
   this.queue = [];
   this.requestPending = false;
}

util.inherits(HueService, Service);

HueService.prototype.coldStart = function() {
 
   var displayResult = function(result) {
       console.log(JSON.stringify(result, null, 2));
   };
 
   this.hue = new Hue(this.linkAddress, this.username);
};

HueService.prototype.turnLightOn = function(_deviceId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on, deviceId: ' + _params.deviceId);
      _this.hue.turnLightOn(_params.deviceId, _callback);
   }, { deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

HueService.prototype.turnLightOff = function(_deviceId, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device off, deviceId: ' + _params.deviceId);
      _this.hue.turnLightOff(_params.deviceId, _callback);
   }, { deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

HueService.prototype.setLightBrightness = function(_roomId, _deviceId, _brightness, _callback) {

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on with brightness level, deviceId: ' + _params.deviceId + ', brightness: ' + _params.brightness);
      _this.hue.setLightBrightness(_params.deviceId, _params.dimLevel, _callback);
   }, { deviceId: _deviceId, brightness: _brightness } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
}

HueService.prototype.addToQueue = function(_request, _params, _callback) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
}

HueService.prototype.makeNextRequest = function() {
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

module.exports = exports = HueService;
