var util = require('util');
var LastPeriodWeather = require('./lastperiodweather');

function LastWeekWeather(_config, _owner) {
   _config.periods = 56;
   LastPeriodWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last Week Weather Monitor created");
}

util.inherits(LastWeekWeather, LastPeriodWeather);

module.exports = exports = LastWeekWeather;

