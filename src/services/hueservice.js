var util = require('util');
var Service = require('../service');
var Hue = require("node-hue-api");

function HueService(_config) {
   Service.call(this, _config);

   this.linkId = _config.linkId;
   this.userId = _config.userId;
   this.username = _config.username;
   this.queue = [];
   this.requestPending = false;
   this.callbacks = {};
   this.requestTimeout = _config.hasOwnProperty("requestTimeout") ? _config.requestTimeout : 3;
}

util.inherits(HueService, Service);

function b(_bridges) {
   console.log(this.username+": Hue Bridges Found: " + JSON.stringify(_bridges));
   process.exit(1);
}

HueService.prototype.coldStart = function() {

  Hue.nupnpSearch( (_err, _result) => {

     if (!_err && _result.length > 0) {
        var bridge = this.findBridge(_result, this.linkId);

         if (bridge) {
            this.hueBridgeFound(bridge);
         }
         else {
            try {
               Hue.upnpSearch(10000).then(HueService.prototype.bridgesFound.bind(this)).done();
            }
            catch(_error) {
               console.error(this.uName + ": No bridges found!");
               process.exit(1);
            }
         }
      }
      else {
         try {
            Hue.upnpSearch(10000).then(HueService.prototype.bridgesFound.bind(this)).done();
         }
         catch(_error) {
            console.error(this.uName + ": No bridges found!");
            process.exit(1);
         }
      }
   });
};

HueService.prototype.findBridge = function (_bridges, _id) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id === _id) {
         return _bridges[i];
      }
   }

   return null;
};

HueService.prototype.fixIds = function(_bridges) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id.substr(6,4) !== "fffe") {
         _bridges[i].id = _bridges[i].id.substr(0,6) + "fffe" + _bridges[i].id.substr(6);
      }
   }
};

HueService.prototype.bridgesFound = function(_bridges) {
   this.fixIds(_bridges);
   console.log("Hue Bridges Found: " + JSON.stringify(_bridges));
   var bridge = this.findBridge(_bridges, this.linkId);

   if (bridge) {
      this.hueBridgeFound(bridge);
   }
   else {
      console.error(this.uName + ": No bridges found!");
      process.exit(1);
   }
};

HueService.prototype.hueBridgeFound = function(_bridge) {
   this.linkAddress = _bridge.ipaddress;

   if (!this.linkAddress) {
      console.error(this.uName + ": Unable to find bridge, My link Id=" + this.linkId + " not Found!");
      process.exit(1);
   }

   this.hue = new Hue.HueApi(this.linkAddress, this.userId);
   this.lightState = Hue.lightState.create();
   this.ready = true;

   this.hue.lights( (_err, _result) => {

      if (_err) {
         console.error(this.uName + ": Unable to get lights status, error=" + _err);
         process.exit(1);
      }

      for (var j = 0; j < _result.lights.length; ++j) {
         var light = _result.lights[j];

         if (this.callbacks[light.id]) {
            extractLightCapability(this, light.id, light, this.callbacks[light.id]);
         }
      }

      this.callbacks = {};
      this.lightStatus = _result;
   });
};

HueService.prototype.getLightCapability = function(_deviceId, _callback) {

   if (!this.lightStatus) {
      this.callbacks[_deviceId] = _callback;
      return;
   }

   extractLightCapability(this, _deviceId, null, _callback);
};

function extractLightCapability(_this, _deviceId, _light, _callback) {
   var light = _light;

   if (!light) {

      for (var j = 0; j < _result.lights.length; ++j) {

         if (_result.lights[j].id == _deviceId) {
            light = _result.lights[j];
         }
      }

      if (!light) {
         _callback("Not Found!");
         return;
      }
   }

   var colourSupported = (light.type == "Extended color light");
   _callback(null, { id: _deviceId, brightness: true, hue: colourSupported, saturation: colourSupported });
}

HueService.prototype.setLightState = function(_deviceId, _config, _callback) {
   this.addToQueue("set", _deviceId, _config, _callback);
};

HueService.prototype.setLightGroupState = function(_groupId, _config, _callback) {
   this.addToQueue("setGroup", _groupId, _config, _callback);
};

HueService.prototype.setScene = function(_sceneId, _callback) {
   this.addToQueue("setScene", _sceneId, {}, _callback);
};

HueService.prototype.turnLightOn = function(_deviceId, _callback) {
   this.addToQueue("set", _deviceId, { power: true }, _callback);
};

HueService.prototype.turnLightOff = function(_deviceId, _callback) {
   this.addToQueue("set", _deviceId, { power: false }, _callback);
};

HueService.prototype.setLightBrightness = function(_deviceId, _brightness, _callback) {
   this.addToQueue("set", _deviceId, { brightness: _brightness }, _callback);
};

HueService.prototype.setLightHue = function(_deviceId, _hue, _callback) {
   this.addToQueue("set", _deviceId, { hue: _hue }, _callback);
};

HueService.prototype.setLightSaturation = function(_deviceId, _saturation, _callback) {
   this.addToQueue("set", _deviceId, { saturation: _saturation }, _callback);
};

HueService.prototype.getLightState = function(_deviceId, _callback) {
   this.addToQueue("get", _deviceId, {}, _callback);
};

HueService.prototype.getLightGroups = function(_callback) {
   this.addToQueue("getLightGroups", null, {}, _callback);
};

HueService.prototype.defaultCallbackHandler = function(_error, _result) {

   if (_error) {
      console.error(this.uName + ": Unable to complete request, error=" + _error);
   }
   else {
      console.log(this.uName + ": Request completed, result=" + _result);
   }
};

HueService.prototype.addToQueue = function(_request, _deviceId, _config, _callback) {
   var  cb = (_callback) ? _callback : HueService.prototype.defaultCallbackHandler.bind(this);
      
   if (!this.ready) {
      cb("Not ready yet!");
      return;
   }

   this.queue.push(new Request(this, _request, _deviceId, _config, cb));
   this.makeNextRequest();
};

HueService.prototype.makeNextRequest = function() {

   if ((this.queue.length > 0) && !this.requestPending) {
      this.requestPending = true;

      this.queue[0].send( (_owner, _error, _result) => {
         console.log(this.uName + ': Request done! Error='+_error);
         this.queue[0].complete(_error, _result);
         delete this.queue.shift();

         var delay = setTimeout(function(_this) {
            _this.requestPending = false;
            _this.makeNextRequest();
         }, 100, this);
      });
   }
};

function Request(_owner, _request, _deviceId, _config, _callback) {
   this.owner = _owner;
   this.request = _request;
   this.deviceId = _deviceId;
   this.callback = _callback;
   this.config = {};

   for (var param in _config) {

      if (_config.hasOwnProperty(param)) {

         switch (param) {
            case "power":
               this.config.on = _config[param];
               break;
            case "brightness":
               this.config.bri = Math.floor(parseFloat(_config[param] * 255 / 100));
               break;
            case "hue":
               this.config.hue = Math.floor(parseFloat(_config[param] * 65535 / 360));
               break;
            case "saturation":
               this.config.sat = Math.floor(parseFloat(_config[param] * 255 / 100));
               break;
         }
      }
   }
}

Request.prototype.send = function(_callback) {

   if (this.request === "get") {
      console.log(this.owner.uName + ': getting light status, deviceId: ' + this.deviceId);

      this.owner.hue.lightStatus(this.deviceId, (_error, _result) => {

         if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            _callback(this.owner, _error, _result);
         }
      });
   }
   else if (this.request === "set") {
      console.log(this.owner.uName + ': setting light status, deviceId: ' + this.deviceId + ' config=', this.config);

      this.owner.hue.setLightState(this.deviceId, this.config, (_error, _result) => {

         if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            _callback(this.owner, _error, _result);
         }
      });
   }
   else if (this.request === "setGroup") {
      console.log(this.owner.uName + ': setting light status, groupId: ' + this.deviceId + ' config=', this.config);

      this.owner.hue.setGroupLightState(this.deviceId, this.config, (_error, _result) => {

         if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            _callback(this.owner, _error, _result);
         }
      });
   }
   else if (this.request === "setScene") {
      console.log(this.owner.uName + ': setting light scene, sceneId: ' + this.deviceId);

      this.owner.hue.activateScene(this.deviceId, (_error, _result) => {

         if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            _callback(this.owner, _error, _result);
         }
      });
   }
   else if (this.request === "getLightGroups") {
      console.log(this.owner.uName + ': getting light groups');

      this.owner.hue.groups( (_error, _result) => {

         if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            _callback(this.owner, _error, _result);
         }
      });
   }

   this.timeout = setTimeout(function(_this) {
      _this.timeout = null;
      _callback(_this.owner, 'Request timed out!', null);
   }, this.owner.requestTimeout*1000, this);
};

Request.prototype.complete = function(_error, _result) {
   this.callback(_error, _result);
};

module.exports = exports = HueService;
