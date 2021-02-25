var util = require('util');
var Service = require('../service');
const request = require('request');

function WeatherService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.clientSecret = _config.clientSecret;
   this.clientId = _config.clientId;

   this.deviceTypes = {
      "current": "currentweather",
      "last24hours": "last24hoursweather",
      "lastweek": "lastweekweather"
   };

   this.devices = {};
}

util.inherits(WeatherService, Service);

WeatherService.prototype.fetchCurrentWeather = function(_serviceNode, _latitude, _longitude, _callback) {
   console.log(this.uName + ": Fetching current 3 hour forecast from the Met Office");

   const options = {
      method: 'GET',
      url: 'https://api-metoffice.apiconnect.ibmcloud.com/metoffice/production/v0/forecasts/point/three-hourly',
      qs: {
         excludeParameterMetadata: true,
         includeLocationName: true,
         latitude: _latitude,
         longitude: _longitude
      },
      headers: {
         'X-IBM-Client-Id': this.clientId,
         'X-IBM-Client-Secret': this.clientSecret,
         accept: 'application/json'
      }
   };

   request(options, (_error, _response, _body) => {

     if (_error) {
        return _callback(_error);
     }

     _callback(null, JSON.parse(_body).features[0].properties.timeSeries[0]);
   });
};

module.exports = exports = WeatherService;
