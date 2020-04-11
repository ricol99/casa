var util = require('util');
var w1bus = require('node-w1bus');
var Service = require('../service');

function OneWireService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.devices = {};
   this.ownedDevices = {};
}

util.inherits(OneWireService, Service);

OneWireService.prototype.coldStart = function() {
   this.oneWireBus = var w1bus.create();

   this.oneWireBus.listAllSensors()
   .then(function(_data){

      for (var i = 0; i < _data.ids.length; ++i) {
         this.devices[_data.ids[i]] = true;
      }
   });
};

OneWireService.prototype.getConfig = function() {
   return this.oneWireBus.getConfig();
};

OneWireService.prototype.deviceConnected = function(_name, _callback) {

   if (this.devices[_name]) {
      this.oneWireBus.isConnected(_name)
      .then(function(_connected) {
         _callback(null, _connected);
      });
   }
   else {
      _callback("Device " + _name + " not found!");
   }
};

OneWireService.prototype.propertySubscribedTo = function(_property, _subscription, _exists) {

   if (!_exists && _subscription.prop.startsWith("1-wire-")) {
      this.ensurePropertyExists(_subscription.prop, 'property', { initialValue: false, }, this.config);
      var s = _subscription.prop.split('-');
      this.createDevice(this, s[2]+"-"+s[3], s[4], _subscription.pollDuration); 
   }
};

OneWireService.prototype.createDevice = function(_name, _measureName, _pollDuration) {

   if (this.devices[_name]) {

      if (this.devices[_name + ":" + _measureName]) {
         console.log(this.uName + ":  Creating new one wire device " + _name + " with measure name " + _measureName);
         this.devices[_name + ":" + _measureName] = new OneWireDevice(_name, _measureName, _pollDuration, this);
         this.devices.start();
      }
      else {
         this.devices.setPollDuration(_pollDuration);
      }
   }
   else {
      console.error(this.uName + ": Unable to find device named " + _name);
   }
};

OneWireService.prototype.serviceMeasureChanged = function(_name, _measureName, _value) {
   this.alignPropertyValue("one-wire-"+_name+"-"+_measureName, _value);
};

function OneWireDevice(_owner, _name, _measureName, _pollDuration) {
   this.owner = _owner;
   this.name = _name;
   this.measureName = _measureName;
   this.pollDuration = _pollDuration;
   this.measure = 0;
}

OneWireDevice.prototype.start = function() {
   var name = this.name;
   var measureName = this.measureName;
   var owner = this.owner;

   this.owner.oneWireBus.getValueFrom(this.name, this.measureName)
   .then((_measure) => {
      owner.serviceMeasureChanged(name, measureName, _measure);
   });
}

OneWireDevice.prototype.setPollDuration = function(_pollDuration) {

   if (_pollDuration < this.pollDuration) {
      this.pollDuration = _pollDuration;
      this.pollDevice();
   }
};

OneWireDevice.prototype.pollDevice = function() {

   if (this.timer) {
      clearTimeout(this.timer);
   }

   this.timer = setTimeout(() => {
      var _this = this;

      this.owner.oneWireBus.getValueFrom(this.name, this.measureName)
      .then((_measure) => {
         _this.owner.serviceMeasureChanged(name, measureName, _measure);
         _this.pollDevice();
      });
   }, this.pollDuration);
}

module.exports = exports = OneWireService;
 
