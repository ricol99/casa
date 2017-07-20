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
}

util.inherits(HueService, Service);

HueService.prototype.coldStart = function() {
   var that = this;

   Hue.nupnpSearch(function(_err, _bridges) {

      if (_err || _bridges.length == 0) {
         console.error(that.uName + ": Unable to find bridge, error=" + _err ? _err : "None Found!");
         process.exit(1);
      }

      console.log("Hue Bridges Found: " + JSON.stringify(_bridges));

      for (var i = 0; i < _bridges.length; ++i) {

         if (_bridges[i].id == that.linkId) {
            that.linkAddress = _bridges[i].ipaddress;
            break;
         }
      }

      if (!that.linkAddress) {
         console.error(that.uName + ": Unable to find bridge, error=" + "Id " + that.linkId + " not Found!");
         process.exit(1);
      }

      that.hue = new Hue.HueApi(that.linkAddress, that.userId);
      that.lightState = Hue.lightState.create();
      that.callbacks = {};
      that.ready = true;

      that.hue.lights(_deviceId, function(_err, _result) {

         if (_err) {
            console.error(that.uName + ": Unable to get lights status, error=" + _err);
            process.exit(1);
         }

         for (var j = 0; j < _result.lights.length; ++j) {
            var light = _result.lights[j];

            if (that.callbacks[light.id]) {
               extractLightCapability(that, light.id, light, that.callbacks[light.id]);
            }
         }

         that.callbacks = {};
      });
   });
};

HueService.prototype.getLightCapability = function(_deviceId, _callback) {

   if (!this.lightStatus) {
      this.callbacks[_deviceId] = _callback;
      return;
   }

   extractLightCapability(that, _deviceId, null, _callback);
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

HueService.prototype.setLightState = function(_config, _callback) {

   if (!this.ready) {
      _callback("Not ready yet!");
      return;
   }

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on, deviceId: ' + _params.deviceId);

      _this.hue.setLightState(_params.deviceId, { "on": _params.config.power, "bri": _params.config.brightness * 255 / 100,
                                                  "hue": _params.config.hue, "sat": _params.config.saturation }, _callback)

   }, { deviceId: _deviceId, config: copyObject(_config)) } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
};

HueService.prototype.turnLightOn = function(_deviceId, _callback) {

   if (!this.ready) {
      _callback("Not ready yet!");
      return;
   }

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device on, deviceId: ' + _params.deviceId);
      _this.hue.setLightState(_params.deviceId, _this.lightState.on(), _callback);
   }, { deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
};

HueService.prototype.turnLightOff = function(_deviceId, _callback) {

   if (!this.ready) {
      _callback("Not ready yet!");
      return;
   }

   this.addToQueue(function(_this, _params, _callback) {
      console.log(_this.uName + ': turning device off, deviceId: ' + _params.deviceId);
      _this.hue.setLightState(_params.deviceId, _this.lightState.off(), _callback);
   }, { deviceId: _deviceId } , _callback);

   if (!this.requestPending) {
      this.makeNextRequest();
   }
};

HueService.prototype.setLightBrightness = function(_deviceId, _brightness, _callback) {
   this.setLightState(_deviceId, { power: (_brightness > 0), brightness: _brightness }, _callback);
};

HueService.prototype.setLightHue = function(_deviceId, _hue, _callback) {
   this.setLightState(_deviceId, { hue: _hue }, _callback);
};
HueService.prototype.setLightSaturation = function(_deviceId, _saturation, _callback) {
   this.setLightState(_deviceId, { saturation: _saturation }, _callback);
};

HueService.prototype.addToQueue = function(_request, _params, _callback) {
   this.queue.push({ request: _request, params: _params, callback: _callback });
};

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
            }, 200, that);
         }
         else {
            that.requestPending = false;
         }
      });
   }
};

function copyObject(_source) {

   if (_source) {
      var newData = {};

      for (var prop in _source) {

         if (_sourceData.hasOwnProperty(prop)){
            newData[prop] = _source[prop];
         }
      }

      return newData;
   }
   else {
      return undefined;
   }
}

module.exports = exports = HueService;
