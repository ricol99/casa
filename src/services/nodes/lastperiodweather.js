var util = require('../../util');
var CurrentWeather = require('./currentweather');

function LastPeriodWeather(_config, _owner) {
   CurrentWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last 24 Hours Weather Monitor created");
   this.results = [];
   this.periods = _config.hasOwnProperty("periods") ? _config.periods : 8;
}

util.inherits(LastPeriodWeather, CurrentWeather);

// Called when current state required
LastPeriodWeather.prototype.export = function(_exportObj) {
   CurrentWeather.prototype.export.call(this, _exportObj);
};

// Called when current state required
LastPeriodWeather.prototype.import = function(_importObj) {
   CurrentWeather.prototype.import.call(this, _importObj);
};

LastPeriodWeather.prototype.coldStart = function() {
   CurrentWeather.prototype.coldStart.call(this);
};

LastPeriodWeather.prototype.hotStart = function() {
   CurrentWeather.prototype.hotStart.call(this);
};

LastPeriodWeather.prototype.start = function() {
   this.started = true;
   this.fetchLastPeriodWeather();

   this.intervalTimer = setInterval( () => {
      this.fetchLastPeriodWeather();
   }, 3600 * 3 * 1000);  // Call every three hours
}

LastPeriodWeather.prototype.fetchLastPeriodWeather = function(_callback) {

   this.fetchCurrentWeather( (_error, _result) => {

      if (_error) {

         if (_callback) {
            return _callback(null, _error);
         }
         else {
            console.error(this.uName +": Unable to fetch weather, error=" + _error);
            return;
         }
      }

      var params = { "temperature": true, "temperature-feels-like": true, "visibility": true, "three-hour-precipitation-total": true, "three-hour-snow-total": true,
                     "wind-direction": true, "average-wind-speed": true, "max-wind-gust": true, "humidity": true, "uv-index": true };

      for (var param in params) {

         if (!_result.hasOwnProperty(param)) {
            return _callback ? _callback("Bad response from server") : false;
         }
      }

      this.results.push(_result);

      if (this.results.length > this.periods) {
         this.results.shift();
      }

      var result = { "temperature": parseFloat(this.average("temperature").toFixed(1)),
                     "temperature-feels-like": parseFloat(this.average("temperature-feels-like").toFixed(1)),
                     "visibility": parseFloat(this.average("visibility").toFixed(0)),
                     "three-hour-precipitation-total": this.total("three-hour-precipitation-total"),
                     "three-hour-snow-total": this.total("three-hour-precipitation-total"),
                     "wind-direction": parseFloat(this.average("wind-direction").toFixed(0)),
                     "average-wind-speed": parseFloat(this.average("average-wind-speed").toFixed(1)),
                     "max-wind-gust": parseFloat(this.max("max-wind-gust").toFixed(1)),
                     "humidity": parseFloat(this.average("humidity").toFixed(2)),
                     "uv-index": parseFloat(this.average("uv-index").toFixed(0)) };

      if (_callback) {
         return _callback(null, result);
      }
      else {
         this.updateLocalProperties(result);
      }
   });
}

LastPeriodWeather.prototype.max = function(_param) {
   var maximum = this.results[0][_param];

   for (var i = 1; i < this.results.length - 1; ++i) {

      if (this.results[i][_param] > maximum) {
         maximum = this.results[i][_param];
      }
   }

   return maximum;
};

LastPeriodWeather.prototype.total = function(_param) {
   var total = 0;

   for (var i = 0; i < this.results.length; ++i) {
      total += this.results[i][_param];
   }

   return total;
};

LastPeriodWeather.prototype.average = function(_param) {
   return this.total(_param) / this.results.length;
};

LastPeriodWeather.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};

module.exports = exports = LastPeriodWeather;

