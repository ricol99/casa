var util = require('util');
var CurrentWeather = require('./currentweather');

function Last24HourWeather(_config, _parent) {
   _config.serviceType = "last24hour";
   CurrentWeather.call(this, _config, _parent);
   this.thingType = "last-24-hour-weather";
}

util.inherits(Last24HourWeather, CurrentWeather);

module.exports = exports = Last24HourWeather;
