var util = require('util');
var CurrentWeather = require('./currentweather');

function Last24HoursWeather(_config, _parent) {
   _config.serviceType = "last24hours";
   CurrentWeather.call(this, _config, _parent);
   this.thingType = "last-24-hours-weather";
}

util.inherits(Last24HoursWeather, CurrentWeather);

module.exports = exports = Last24HoursWeather;
