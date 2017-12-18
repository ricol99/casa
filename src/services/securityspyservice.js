var util = require('util');
var Service = require('../service');

function SecuritySpyService(_config) {
   Service.call(this, _config);

   this.hostname = _config.hostname;
   this.port = _config.port;
   this.userId = _config.userId;
   this.password = _config.password;

   this.secure = (_config.hasOwnProperty("secure")) ? _config.secure : false;
   this.http = (this.secure) ? require('https') : require('http');

   this.options = { hostname: this.hostname, port: this.port, auth: this.userId + ':' + this.password };
   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 3;

   this.queue = [];
   this.requestPending = false;
}

util.inherits(SecuritySpyService, Service);

SecuritySpyService.prototype.coldStart = function() {
};

SecuritySpyService.prototype.setContinuousCapture = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlContinuousCapture?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), _callback);
}

SecuritySpyService.prototype.setMotionCapture = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlMotionCapture?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), _callback);
}

SecuritySpyService.prototype.setActions = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlActions?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), _callback);
}

SecuritySpyService.prototype.triggerMotionRecording = function(_cameraId, _callback) {
   this.addToQueue("/++triggermd?cameraNum=" + cameraId, _callback);
}

SecuritySpyService.prototype.getCameraModes = function(_cameraId, _callback) {
   this.addToQueue("/++cameramodes?cameraNum=" + cameraId, _callback);
}

SecuritySpyService.prototype.addToQueue = function(_path, _callback) {
   this.queue.push(new Request(this, _path, _callback));
   this.makeNextRequest();
}

SecuritySpyService.prototype.makeNextRequest = function() {

   if ((this.queue.length > 0) && !this.requestPending) {
      this.requestPending = true;
      this.queue[0].send();
   }
}

SecuritySpyService.prototype.completeRequest = function(_error, _content) {
   console.log(this.uName + ': Request done! Code='+_code);

   this.queue.shift().complete(_error, _content);

   if (this.queue.length > 0) {

      // More in the queue, so reschedule after the link has had time to settle down
      var delay = setTimeout(function(_this) {
         _this.requestPending = false;
         _this.makeNextRequest();
      }, 200, this);
   }
   else {
      this.requestPending = false;
   }
}

function Request(_owner, _path, _callback) {
   this.owner = _owner;
   this.path = _path;
   this.callback = _callback;
}

Request.prototype.send = function() {
   this.owner.options.path = this.path;
   var that = this;

   http.owner.get(this.options, function(_res) {
      console.log('STATUS: ' + _res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(_res.headers));
      that.owner.completeRequest(null, _res.content);
   }).on('error', function(_err) {
      console.log("Got error: " + _err.message);
      that.owner.completeRequest(_err.message, null);
   });

   this.timeout = setTimeout(function(_this) {
      _this.timeout = null;
      _this.owner.completeRequest('Request timed out!', null);
   }, this.owner.requestTimeout*1000, this);
};

Request.prototype.complete = function(_error, _content) {

   if (this.timeout) {
      clearTimeout(this.timeout);
   }

   this.callback(_error, _content);
};

module.exports = exports = SecuritySpyService;
