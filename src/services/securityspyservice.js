var util = require('util');
var Service = require('../service');

function SecuritySpyService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.hostname = _config.hostname;
   this.port = _config.port;
   this.userId = _config.userId;
   this.password = _config.password;

   this.secure = (_config.hasOwnProperty("secure")) ? _config.secure : (this.hostname.lastIndexOf("https", 0) === 0);
   this.http = (this.secure) ? require('https') : require('http');

   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 5;
   this.options = { hostname: this.hostname, port: this.port, auth: this.userId + ':' + this.password, rejectUnauthorized: false, requestCert: true, agent: false, timeout: this.requestTimeout*1000 };

   this.q = [];
   this.cameras = {};
   this.requestPending = false;
   this.initialInfoReceived = false;
}

util.inherits(SecuritySpyService, Service);

// Called when current state required
SecuritySpyService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
SecuritySpyService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

SecuritySpyService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

SecuritySpyService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

SecuritySpyService.prototype.start = function() {
   this.systemInfo = new SystemInfo(this);

   this.systemInfo.sync( (_err, _result) => {

      if (!_err) {
         this.liveStreamListener = new LiveStreamListener(this);
         this.liveStreamListener.start();
      }
   });
};

SecuritySpyService.prototype.registerCamera = function(_cameraId, _cameraObj) {

   if (!this.cameras[_cameraId.toString()]) {
      this.cameras[_cameraId.toString()] = {};
      this.cameras[_cameraId.toString()].ACTIVE = false;
      this.cameras[_cameraId.toString()]["continuous-capture"] = false;
      this.cameras[_cameraId.toString()]["motion-capture"] = false;
      this.cameras[_cameraId.toString()].actions = false;
   }

   this.cameras[_cameraId.toString()].cameraObj = _cameraObj;

   if (this.initialInfoReceived) {
      this.syncWithCameraObj(_cameraId);
   }
};

SecuritySpyService.prototype.deregisterCamera = function(_cameraId, _camera) {

   if (this.cameras[_cameraId.toString()]) {
      this.cameras[_cameraId.toString()].cameraObj = null;
   }
};

SecuritySpyService.prototype.needToSync = function(_cameraId, _property, _value) {
   return this.cameras[_cameraId.toString()][_property] !== _value;
};

SecuritySpyService.prototype.cameraPropUpdateReceivedFromServer = function(_cameraId, _properties) {

   if (!this.cameras[_cameraId.toString()]) {
      this.cameras[_cameraId.toString()] = {};
   }

   for (index in _properties) {
      this.cameras[_cameraId.toString()][index] = _properties[index];
   }

   this.syncWithCameraObj(_cameraId);
};

SecuritySpyService.prototype.syncWithCameraObj = function(_cameraId) {
   console.log(this.uName + ": syncWithCameraObj() Camera ID=" + _cameraId);

   if (!this.cameras[_cameraId.toString()] || (!this.cameras[_cameraId.toString()].cameraObj)) {
      return;
   }

   var cameraObj = this.cameras[_cameraId.toString()].cameraObj;
   var properties = [];

   for (prop in this.cameras[_cameraId.toString()]) {

      if (prop == "cameraObj") {
         continue;
      }

      if (this.cameras[_cameraId.toString()][prop] !== cameraObj.getProperty(prop)) {
         properties.push({ property: prop, value: this.cameras[_cameraId.toString()][prop] });
      }
   }

   if (properties.length > 0) {
      cameraObj.alignProperties(properties);
   }
};

SecuritySpyService.prototype.newEventFromServer = function(_cameraId, _event) {

   if (this.cameras[_cameraId.toString()] && this.cameras[_cameraId.toString()].cameraObj) {
      this.cameras[_cameraId.toString()].cameraObj.raiseEvent(_event);
   }
};

SecuritySpyService.prototype.setContinuousCapture = function(_cameraId, _state, _callback) {

   if (this.needToSync(_cameraId, "continuous-capture", _state)) {
      this.addToQueue("/++ssControlContinuousCapture?cameraNum=" + _cameraId + "&arm=" + (_state ? "1" : "0"), "contCapture", _callback);
   }
};

SecuritySpyService.prototype.setMotionCapture = function(_cameraId, _state, _callback) {

   if (this.needToSync(_cameraId, "motion-capture", _state)) {
      this.addToQueue("/++ssControlMotionCapture?cameraNum=" + _cameraId + "&arm=" + (_state ? "1" : "0"), "motionCapture", _callback);
   }
};

SecuritySpyService.prototype.setActions = function(_cameraId, _state, _callback) {

   if (this.needToSync(_cameraId, "actions", _state)) {
      this.addToQueue("/++ssControlActions?cameraNum=" + _cameraId + "&arm=" + (_state ? "1" : "0"), "actions", _callback);
   }
};

SecuritySpyService.prototype.triggerMotionRecording = function(_cameraId, _callback) {
   this.addToQueue("/++triggermd?cameraNum=" + cameraId, "triggerMotion", _callback);
};

SecuritySpyService.prototype.getCameraModes = function(_cameraId, _callback) {
   this.addToQueue("/++cameramodes?cameraNum=" + _cameraId, "cameraModes", _callback);
};

SecuritySpyService.prototype.addToQueue = function(_path, _requestType, _callback) {
   this.q.push(new Request(this, _requestType, _path, _callback));
   this.makeNextRequest();
};

SecuritySpyService.prototype.makeNextRequest = function() {

   if ((this.q.length > 0) && !this.requestPending) {
      this.requestPending = true;
      this.q[0].send();
   }
};

SecuritySpyService.prototype.completeRequest = function(_error, _content) {
   console.log(this.uName + ": Request done!");

   this.q.shift().complete(_error, _content);

   if (this.q.length > 0) {

      // More in the queue, so reschedule after the link has had time to settle down
      var delay = setTimeout(function(_this) {
         _this.requestPending = false;
         _this.makeNextRequest();
      }, 200, this);
   }
   else {
      this.requestPending = false;
   }
};

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

   this.owner.http.get(this.owner.options, (_res) => {
      //console.log('AAAAA STATUS: ' + _res.statusCode);
      //console.log('AAAAA HEADERS: ' + JSON.stringify(_res.headers));

      if (!this.expectData) {
         _res.resume();
         this.owner.completeRequest(null, _res.statusCode == 200);
         return;
      }

      _res.on('data', (_data) => {
         this.data = Buffer.concat([this.data, _data], this.data.length + _data.length);
      });

      _res.on('end', () => {
         this.processAllData();
      });

   }).on('error', (_err) => {
      console.error(this.owner.name + ": Received error from http link: " + _err.message);
      this.owner.completeRequest(_err.message, null);
   });
};

Request.prototype.processAllData = function() {
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

function LiveStreamListener(_owner) {
   this.http = (_owner.secure) ? require('https') : require('http');
   this.owner = _owner;
   this.options = { hostname: _owner.hostname, port: _owner.port, auth: _owner.userId + ':' + _owner.password,
                    path: "/++eventStream/", rejectUnauthorized: false, requestCert: true, agent: false, timeout: _owner.requestTimeout*1000 };

   this.linkOpen = false;
}

LiveStreamListener.prototype.start = function() {

   this.http.get(this.options, (_res) => {

      if (_res.statusCode != 200) {
         _res.resume();
         this.restartLink();
         return;
      }

      this.linkOpen = true;
      _res.setEncoding('utf8');

      _res.on('data', (_data) => {
         var lines = _data.split(/\r?\n/);

         for (index in lines) {
            this.processLine(lines[index]);
         }
      });

      _res.on('end', () => {
         this.restartLink();
      });

   }).on('error', (_err) => {
      console.error(this.owner.name + ": Listener connection error=" + _err.message + ". Will reconnect soon");
      this.lineOpen = false;
      this.restartLink();
   });

};

LiveStreamListener.prototype.stop = function() {

   if (this.linkOpen) {
      this.http.close();
      this.linkOpen = false;
   }
};

LiveStreamListener.prototype.restartLink = function() {

   setTimeout(function(_this) {
      _this.start();
   }, 60000, this);
};

LiveStreamListener.prototype.processLine = function(_line) {
   var params = _line.split(" ");

   if (params.length < 4) {
      return;
   }

   var cameraId = params[2].substr(3);
   var changeParam = params[3].substr(0, params[3].length - 1);

   var change = { ARM_C: { property: "continuous-capture", value: true },
                  DISARM_C: { property: "continuous-capture", value: false },
                  ARM_M: { property: "motion-capture", value: true },
                  DISARM_M: { property: "motion-capture", value: false },
                  ARM_A: { property: "actions", value: true },
                  DISARM_A: { property: "actions", value: false },
                  MOTION: { event: "motion-detected" },
                  ONLINE: { property: "ACTIVE", value: true },
                  OFFLINE: { property: "ACTIVE", value: false } };

   if (!change[changeParam]) {
      return;
   }

   if (change[changeParam].hasOwnProperty("property")) {
      var properties = {};
      properties[change[changeParam].property] = change[changeParam].value;
      this.owner.cameraPropUpdateReceivedFromServer(cameraId, properties);
   }
   else {
      this.owner.newEventFromServer(cameraId, change[changeParam].event);
   }
};

function SystemInfo(_owner) {
   this.http = (_owner.secure) ? require('https') : require('http');
   this.owner = _owner;
   this.options = { hostname: _owner.hostname, port: _owner.port, auth: _owner.userId + ':' + _owner.password,
                    path: "/++systemInfo/", rejectUnauthorized: false, requestCert: true, agent: false, timeout: _owner.requestTimeout*1000 };

   this.data = "";
}

SystemInfo.prototype.sync = function(_callback) {

   this.http.get(this.options, (_res) => {

      if (_res.statusCode != 200) {
         _res.resume();
         _callback(_res.StatusCode);
         return;
      }

      _res.setEncoding('utf8');

      _res.on('data', (_data) => {
         this.data = this.data + _data;
      });

      _res.on('end', () => {
         this.processAllData(_callback);
      });
   }).on('error', (_err) => {
      console.error(this.owner.name + ": Unable to sync System Info, error=" + _err.message);
   });
};

SystemInfo.prototype.processAllData = function(_callback) {
   var parseString = require('xml2js').parseString;

   parseString(this.data, (_err, _result) => {

      if (_err) {
         console.error(this.owner.name + ": Unable to parse received XML string!");
         _callback(_err);
         return;
      }

      if (!_result.hasOwnProperty("system") || !_result.system.hasOwnProperty("cameralist") || !_result.system.cameralist[0].hasOwnProperty("camera")) {
         console.error(this.owner.name + ": Unable to parse received XML string!");
         _callback("Unable to parse XML string!");
         return;
      }

      for (index in _result.system.cameralist[0].camera) {

         var properties = { "ACTIVE": _result.system.cameralist[0].camera[index].connected == "yes",
                       "continuous-capture": _result.system.cameralist[0].camera[index]["mode-c"] == "armed",
                       "motion-capture": _result.system.cameralist[0].camera[index]["mode-m"] == "armed",
                       "actions": _result.system.cameralist[0].camera[index]["mode-a"] == "armed" };

         this.owner.cameraPropUpdateReceivedFromServer(_result.system.cameralist[0].camera[index].number, properties);
      }

      this.initialInfoReceived = true;
      _callback(null, true);
   });
};

module.exports = exports = SecuritySpyService;
