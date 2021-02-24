var util = require('util');
var CurrentWeather = require('./currentweather');

function Last24HourWeather(_config, _owner) {
   CurrentWeather.call(this, _config, _owner);
   console.log(this.uName + ": New Last 24 Hours Weather Monitor created");
   this.results = [];
}

util.inherits(Last24HourWeather, CurrentWeather);

Last24HourWeather.prototype.start = function() {
   this.started = true;
   this.fetchLast24HourWeather();

   this.intervalTimer = setInterval( () => {
      this.fetchLast24HourWeather();
   }, 3600 * 3 * 1000);  // Call every three hours
}

Last24HourWeather.prototype.fetchLast24HourWeather = function(_callback) {

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

      this.results.push(_result);

      if (this.results.length > 8) {
         this.result.shift();
      }

      var result = { "temperature": this.average("temperature"),
                     "temperature-feels-like": this.average("temperature-feels-like"),
                     "visibility": this.average("visibility"),
                     "three-hour-precipitation-total": this.total("three-hour-precipitation-total"),
                     "three-hour-snow-total": this.total("three-hour-precipitation-total"),
                     "wind-direction": this.average("wind-direction"),
                     "average-wind-speed": this.average("average-wind-speed"),
                     "max-wind-gust": this.max("max-wind-gust"),
                     "humidity": this.average("humidity"),
                     "uv-index": this.average("uv-index") };

      if (_callback) {
         return _callback(null, result);
      }
      else {
         this.updateLocalProperties(result);
      }
   });
}

Last24HourWeather.prototype.max = function(_param) {
   var maximum = this.results[0][_param];

   for (var i = 0; i < this.results.length - 1; ++i) {

      if (this.results[i][_param] > maximum) {
         maximum = this.results[i][_param];
      }
   }

   return maximum;
};

Last24HourWeather.prototype.total = function(_param) {
   var total = 0;

   for (var i = 0; i < this.results.length; ++i) {
      total += this.results[i][_param];
   }

   return total;
};

Last24HourWeather.prototype.average = function(_param) {
   return this.total(_param) / this.results.length;
};

Last24HourWeather.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
};

module.exports = exports = Last24HourWeather;

