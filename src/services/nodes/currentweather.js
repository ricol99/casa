var util = require('util');
var ServiceNode = require('./servicenode');

function CurrentWeather(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   console.log(this.uName + ": New Current Wather Monitor created");
   this.started = false;
   this.ensurePropertyExists("temperature", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("temperature-feels-like", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("visibility", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("three-hour-precipitation-total", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("three-hour-snow-total", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("wind-direction", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("average-wind-speed", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("max-wind-gust", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("humidity", 'property', { initialValue: 0 }, this.config);
   this.ensurePropertyExists("uv-index", 'property', { initialValue: 0 }, this.config);
}

util.inherits(CurrentWeather, ServiceNode);

CurrentWeather.prototype.newSubscriptionAdded = function(_subscription) {

   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);

   if (_subscription.args.hasOwnProperty("latitude") && _subscription.args.hasOwnProperty("longitude")) {
      this.latitude = _subscription.args.latitude;
      this.longitude = _subscription.args.longitude;

      if (!this.started) {
         this.start();
      }
   }
};

CurrentWeather.prototype.start = function() {
   this.started = true;
   this.fetchCurrentWeather();

   this.intervalTimer = setInterval( () => {
      this.fetchCurrentWeather();
   }, 3600 * 3 * 1000);  // Call every three hours
}

CurrentWeather.prototype.fetchCurrentWeather = function(_callback) {

   this.owner.fetchCurrentWeather(this, this.latitude, this.longitude, (_error, _result) => {

      if (_error) {

         if (_callback) {
            return _callback(null, _error);
         }
         else {
            console.error(this.uName +": Unable to fetch weather, error=" + _error);
            return;
         }
      }

      var result = { temperature: Math.floor((_result.maxScreenAirTemp + _result.minScreenAirTemp) / 2.0),
                     "temperature-feels-like": _result.feelsLikeTemp,
                     "visibility": _result.visibility,
                     "three-hour-precipitation-total": _result.totalPrecipAmount,
                     "three-hour-snow-total": _result.totalSnowAmount,
                     "wind-direction": _result.windDirectionFrom10m,
                     "average-wind-speed": _result.windSpeed10m,
                     "max-wind-gust": _result.windGustSpeed10m,
                     "humidity": _result.screenRelativeHumidity,
                     "uv-index": _result.uvIndex };

      if (_callback) {
         return _callback(null, result);
      }
      else {
         this.updateLocalProperties(result);
     }
      
   });
}

CurrentWeather.prototype.updateLocalProperties = function(_result) {
   var props = [];
   for (var prop in _result) {

      if (_result.hasOwnProperty(prop)) {
         props.push( { property: prop, value: _result[prop] });
      }
   }

   this.alignProperties(props);
};

CurrentWeather.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};

module.exports = exports = CurrentWeather;

/*
{ time: '2021-02-23T15:00Z',
  maxScreenAirTemp: 12.620654,
  minScreenAirTemp: 12.591272,
  max10mWindGust: 16.032938,
  significantWeatherCode: 1,
  totalPrecipAmount: 0,
  totalSnowAmount: 0,
  windSpeed10m: 6.48,
  windDirectionFrom10m: 192,
  windGustSpeed10m: 12.86,
  visibility: 17950,
  mslp: 102470,
  screenRelativeHumidity: 65.92,
  feelsLikeTemp: 9.82,
  uvIndex: 1,
  probOfPrecipitation: 0,
  probOfSnow: 0,
  probOfHeavySnow: 0,
  probOfRain: 0,
  probOfHeavyRain: 0,
  probOfHail: 0,
  probOfSferics: 0 }
*/

