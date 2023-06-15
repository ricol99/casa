var util = require('../../util');
var LastPeriodWeather = require('./lastperiodweather');

function LastWeekWeather(_config, _owner) {
   _config.periods = 56;
   LastPeriodWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last Week Weather Monitor created");
}

util.inherits(LastWeekWeather, LastPeriodWeather);

// Called when current state required
LastWeekWeather.prototype.export = function(_exportObj) {
   LastPeriodWeather.prototype.export.call(this, _exportObj);
};

// Called when current state required
LastWeekWeather.prototype.import = function(_importObj) {
   LastPeriodWeather.prototype.import.call(this, _importObj);
};

LastWeekWeather.prototype.coldStart = function() {
   LastPeriodWeather.prototype.coldStart.call(this);
};

LastWeekWeather.prototype.hotStart = function() {
   LastPeriodWeather.prototype.hotStart.call(this);
};

module.exports = exports = LastWeekWeather;

