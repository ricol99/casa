var util = require('util');
var Thing = require('../thing');

function CurrentWeather(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "current-weather";
   this.displayName = _config.displayName;
   this.latitude = _config.latitude;
   this.longitude = _config.longitude;
   this.coords = ("LA" + this.latitude + "LO" + this.longitude).replace(/-/g, "m").replace(/\./g, "p");
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("weatherservice");
   this.serviceType = (_config.hasOwnProperty("serviceType")) ? _config.serviceType : "current";

   if (!this.serviceName) {
      console.error(this.uName + ": ***** Weather service not found! *************");
      process.exit();
   }

   let spec = { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read", serviceArgs: { latitude: this.latitude, longitude:this.longitude }};

   this.ensurePropertyExists("temperature", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("temperature-feels-like", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("visibility", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("three-hour-precipitation-total", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("three-hour-snow-total", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("wind-direction", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("average-wind-speed", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("max-wind-gust", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("humidity", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

   this.ensurePropertyExists("uv-index", 'serviceproperty',
                             { initialValue: 0, id: this.coords, serviceType: this.serviceType, serviceName: this.serviceName, sync: "read",
                               serviceArgs: { latitude: this.latitude, longitude:this.longitude }}, this.config);

}

util.inherits(CurrentWeather, Thing);

// Called when current state required
CurrentWeather.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
CurrentWeather.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

CurrentWeather.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

CurrentWeather.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = CurrentWeather;
