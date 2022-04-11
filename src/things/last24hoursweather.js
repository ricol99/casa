var util = require('util');
var CurrentWeather = require('./currentweather');

function Last24HoursWeather(_config, _parent) {
   _config.serviceType = "last24hours";
   CurrentWeather.call(this, _config, _parent);
   this.thingType = "last-24-hours-weather";
}

util.inherits(Last24HoursWeather, CurrentWeather);

// Called when current state required
Last24HoursWeather.prototype.export = function(_exportObj) {
   CurrentWeather.prototype.export.call(this, _exportObj);
};

// Called when current state required
Last24HoursWeather.prototype.import = function(_importObj) {
   CurrentWeather.prototype.import.call(this, _importObj);
};

Last24HoursWeather.prototype.coldStart = function() { 
   CurrentWeather.prototype.coldStart.call(this);
};

Last24HoursWeather.prototype.hotStart = function() {
   CurrentWeather.prototype.hotStart.call(this);
};

module.exports = exports = Last24HoursWeather;
