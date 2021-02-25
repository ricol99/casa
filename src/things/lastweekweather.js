var util = require('util');
var CurrentWeather = require('./currentweather');

function LastWeekWeather(_config, _parent) {
   _config.serviceType = "lastweek";
   CurrentWeather.call(this, _config, _parent);
   this.thingType = "last-week-weather";
}

util.inherits(LastWeekWeather, CurrentWeather);

module.exports = exports = LastWeekWeather;
