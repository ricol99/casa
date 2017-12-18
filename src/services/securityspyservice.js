var util = require('util');
var Service = require('../service');

function SecuritySpyService(_config) {
   Service.call(this, _config);

   this.hostname = _config.hostname;
   this.port = _config.port;
   this.userId = _config.userId;
   this.password = _config.password;

   this.secure = (_config.hasOwnProperty("secure")) ? _config.secure : (this.hostname.lastIndexOf("https", 0) === 0);
   this.http = (this.secure) ? require('https') : require('http');

   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 5;
   this.options = { hostname: this.hostname, port: this.port, auth: this.userId + ':' + this.password, rejectUnauthorized: false, requestCert: true, agent: false, timeout: this.requestTimeout*1000 };

   this.queue = [];
   this.requestPending = false;
}

util.inherits(SecuritySpyService, Service);

SecuritySpyService.prototype.coldStart = function() {
   var that = this;
   this.getCameraModes(0, function(_err, _result) {

      if (!_err) {
         console.log(that.uName + ": AAAAAA Result=", _result);
      }
   });
};

SecuritySpyService.prototype.setContinuousCapture = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlContinuousCapture?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), "contCapture", _callback);
}

SecuritySpyService.prototype.setMotionCapture = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlMotionCapture?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), "motionCapture", _callback);
}

SecuritySpyService.prototype.setActions = function(_cameraId, _state, _callback) {
   this.addToQueue("/++ssControlActions?cameraNum=" + cameraId + "&arm=" + (_state ? "1" : "0"), "actions", _callback);
}

SecuritySpyService.prototype.triggerMotionRecording = function(_cameraId, _callback) {
   this.addToQueue("/++triggermd?cameraNum=" + cameraId, "triggerMotion", _callback);
}

SecuritySpyService.prototype.getCameraModes = function(_cameraId, _callback) {
   this.addToQueue("/++cameramodes?cameraNum=" + _cameraId, "cameraModes", _callback);
}

SecuritySpyService.prototype.addToQueue = function(_path, _requestType, _callback) {
   this.queue.push(new Request(this, _requestType, _path, _callback));
   this.makeNextRequest();
}

SecuritySpyService.prototype.makeNextRequest = function() {

   if ((this.queue.length > 0) && !this.requestPending) {
      this.requestPending = true;
      this.queue[0].send();
   }
}

SecuritySpyService.prototype.completeRequest = function(_error, _content) {
   console.log(this.uName + ": Request done!");

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

function Request(_owner, _requestType, _path, _callback) {
   this.owner = _owner;
   this.requestType = _requestType;
   this.path = _path;
   this.callback = _callback;
   this.expectData = (_requestType === "cameraModes");

   if (this.expectData) {
      this.data = new Buffer("",'utf8');
   }
}

Request.prototype.send = function() {
   this.owner.options.path = this.path;
   var that = this;

   this.owner.http.get(this.owner.options, function(_res) {
      //console.log('AAAAA STATUS: ' + _res.statusCode);
      //console.log('AAAAA HEADERS: ' + JSON.stringify(_res.headers));

      if (!that.expectData) {
         _res.resume();
         that.owner.completeRequest(null, _res.statusCode == 200);
         return;
      }

      _res.on('data', function(_data) {
         that.data = Buffer.concat([that.data, _data], that.data.length + _data.length);
      });

      _res.on('end', function() {
         that.processData();
      });

   }).on('error', function(_err) {
      console.error(that.owner.uName + ": Received error from http link: " + _err.message);
      that.owner.completeRequest(_err.message, null);
   });
};

Request.prototype.processData = function() {
   var response = {};

   switch (this.requestType) {
      case "cameraModes" :
         var lines = this.data.toString('utf8').split(/\r?\n/);
         response = { C: true, M: true, A: true };

         for (var i = 0; i < lines.length; ++i) {

            if (response[lines[i].charAt(0)]) {
               response[lines[i].charAt(0)] = lines[i].substr(2) === "ARMED";
            }
         }
         break;
      default:
         response.data = this.data;
   }

   this.owner.completeRequest(null, response);
};

Request.prototype.complete = function(_error, _content) {
   this.callback(_error, _content);
};

module.exports = exports = SecuritySpyService;
