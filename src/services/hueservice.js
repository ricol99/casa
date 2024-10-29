var util = require('util');
var Service = require('../service');
var Hue = require("node-hue-api");

function HueService(_config, _owner) {
   _config.queueQuant = 150;
   _config.deviceTypes = { "light": "hueservicelight", "lightgroup": "hueservicelightgroup" };

   Service.call(this, _config, _owner);

   this.bridgesAvailable = [];
   this.linkId = _config.linkId;
   this.userId = _config.userId;
   this.username = _config.username;
   this.linkAddress = _config.linkAddress;
   this.updateFrequency = _config.hasOwnProperty("updateFrequency") ? _config.updateFrequency : 30;
}

util.inherits(HueService, Service);

// Called when current state required
HueService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
HueService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

HueService.prototype.coldStart = function() {
   this.start();
   Service.prototype.coldStart.call(this);
};

HueService.prototype.hotStart = function() {
   this.start();
   Service.prototype.hotStart.call(this);
};

HueService.prototype.start = function() {

   if (this.userId) {

      if (this.linkAddress) {
         this.connectToBridge();
      }
      else if (this.linkId) {

         this.findBridges((_err, _bridges) => {

            if (_err || (_bridges.length === 0)) {
               console.error(this.uName + ": Unable to find any bridges! Error="+_err);
               process.exit(1);
            }

            console.log("Hue Bridges Found: " + JSON.stringify(_bridges));
            var bridge = findBridge(_bridges, this.linkId);

            if (bridge && bridge.ipAddress) {
               this.linkAddress = bridge.ipAddress;
               this.connectToBridge();
            }
            else {
               console.error(this.uName + ": Bridge not found!");
               process.exit(1);
            }
         });
      }
   }
   else {
      console.error(this.uName + ": Configuration for hue service not complete");
   }
};

HueService.prototype.findBridges = function(_callback) {

   Hue.nupnpSearch( (_err, _bridgesFoundSearch1) => {
      var bridgesAvailable = [];

      if (!_err) {
         bridgesAvailable = _bridgesFoundSearch1;
      }

      try {
         Hue.upnpSearch(20000).then((_bridgesFoundSearch2) => {
            fixIds(_bridgesFoundSearch2);
            var availableLen = bridgesAvailable.length;
            var matchFound;

            for (var i = 0; i <_bridgesFoundSearch2.length; ++i) {
               matchFound = false;

               for (var j = 0; j < availableLen; ++j) {

                  if (bridgesAvailable[j].id === _bridgesFoundSearch2[i].id) {
                     matchFound = true;
                     break;
                  }
               }

               if (!matchFound) {
                  bridgesAvailable.push(_bridgesFoundSearch2[i]);
               }
            }

         _callback(null, bridgesAvailable);
         }).done();
      }
      catch(_error) {
         _callback(null, bridgesAvailable);
      }
   });
};

HueService.prototype.createUserOnBridge = function(_linkIpAddress, _callback) {
   var hue = new Hue.HueApi();

   hue.registerUser(_linkIpAddress, "Casa Home Automation")
    .then((_result) => {
       return _callback(null, _result);
    })
    .fail((_error) => {
       return _callback(_error);
    })
    .done();
};


HueService.prototype.connectToBridge = function() {
   this.hue = new Hue.HueApi(this.linkAddress, this.userId);
   this.ready = true;
   this.alignPropertyValue("hub-connected", true);
};

HueService.prototype.setLightState = function(_deviceId, _config, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState(_config, _callback);
};

HueService.prototype.setLightGroupState = function(_groupId, _config, _callback) {
   var serviceNode = this.findOrCreateNode("lightgroup", _groupId);
   serviceNode.setState(_config, _callback);
};

HueService.prototype.turnLightOn = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ power: true }, _callback);
};

HueService.prototype.turnLightOff = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ power: false }, _callback);
};

HueService.prototype.setLightBrightness = function(_deviceId, _brightness, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ brightness: _brightness }, _callback);
};

HueService.prototype.setLightHue = function(_deviceId, _hue, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ hue: _hue }, _callback);
};

HueService.prototype.setLightSaturation = function(_deviceId, _saturation, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ saturation: _saturation }, _callback);
};

HueService.prototype.setLightColourTemp = function(_deviceId, _colourTemp, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.setState({ "colour-temp": _colourTemp }, _callback);
};

HueService.prototype.getLightState = function(_deviceId, _callback) {
   var serviceNode = this.findOrCreateNode("light", _deviceId);
   serviceNode.getState(_callback);
};

HueService.prototype.getLightGroups = function(_callback) {
  var transaction = { action: "getLightGroups", callback: _callback };
  this.queueTransaction(this, transaction);
};

HueService.prototype.convertProperties = function(_properties) {
   var config = {};

   for (var prop in _properties) {

      if (_properties.hasOwnProperty(prop)) {

         switch (prop) {
            case "power":
               config.on = _properties[prop];
               break;
            case "brightness":
               config.bri = Math.floor(parseFloat(_properties[prop] * 255 / 100));
               break;
            case "hue":
               config.hue = Math.floor(parseFloat(_properties[prop] * 65535 / 360));
               break;
            case "saturation":
               config.sat = Math.floor(parseFloat(_properties[prop] * 255 / 100));
               break;
            case "colour-temp":
               config.ct = _properties[prop];
               break;
         }
      }
   }

   return config;
};

// Override this to indicate if a transaction is ready to come off the queue
// @return true - transaction successfully processed
//         false - transaction has not been processed, please requeue if possible
HueService.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

HueService.prototype.processGetLightGroups = function(_transaction, _callback) {
   this.owner.hue.groups(_callback);
};


// Internal functions
function findBridge(_bridges, _id) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id === _id) {
         return _bridges[i];
      }
   }

   return null;
};

function b(_bridges) {
   console.log(this.username+": Hue Bridges Found: " + JSON.stringify(_bridges));
   process.exit(1);
}

function fixIds(_bridges) {

   for (var i = 0; i < _bridges.length; ++i) {

      if (_bridges[i].id.substr(6,4) !== "fffe") {
         _bridges[i].id = _bridges[i].id.substr(0,6) + "fffe" + _bridges[i].id.substr(6);
      }
   }
};

module.exports = exports = HueService;
