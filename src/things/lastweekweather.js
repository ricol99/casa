var util = require('util');
var CurrentWeather = require('./currentweather');

function LastWeekWeather(_config, _parent) {
   _config.serviceType = "lastweek";
   CurrentWeather.call(this, _config, _parent);
   this.thingType = "last-week-weather";
}

util.inherits(LastWeekWeather, CurrentWeather);

// Called when current state required
LastWeekWeather.prototype.export = function(_exportObj) {
   CurrentWeather.prototype.export.call(this, _exportObj);
};

// Called when current state required
LastWeekWeather.prototype.import = function(_importObj) {
   CurrentWeather.prototype.import.call(this, _importObj);
};

LastWeekWeather.prototype.coldStart = function() { 
   CurrentWeather.prototype.coldStart.call(this);
};

LastWeekWeather.prototype.hotStart = function() {
   CurrentWeather.prototype.hotStart.call(this);
};

module.exports = exports = LastWeekWeather;
