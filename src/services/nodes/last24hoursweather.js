var util = require('util');
var LastPeriodWeather = require('./lastperiodweather');

function Last24HoursWeather(_config, _owner) {
   _config.periods = 8;
   LastPeriodWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last 24 Hours Weather Monitor created");
}

util.inherits(Last24HoursWeather, LastPeriodWeather);

// Called when current state required
Last24HoursWeather.prototype.export = function(_exportObj) {
   LastPeriodWeather.prototype.export.call(this, _exportObj);
};

// Called when current state required
Last24HoursWeather.prototype.import = function(_importObj) {
   LastPeriodWeather.prototype.import.call(this, _importObj);
};

Last24HoursWeather.prototype.coldStart = function() {
   LastPeriodWeather.prototype.coldStart.call(this);
};

Last24HoursWeather.prototype.hotStart = function() {
   LastPeriodWeather.prototype.hotStart.call(this);
};

module.exports = exports = Last24HoursWeather;

