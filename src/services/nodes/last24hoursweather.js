var util = require('util');
var LastPeriodWeather = require('./lastperiodweather');

function Last24HoursWeather(_config, _owner) {
   _config.periods = 8;
   LastPeriodWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last 24 Hours Weather Monitor created");
}

util.inherits(Last24HoursWeather, LastPeriodWeather);

module.exports = exports = Last24HoursWeather;

