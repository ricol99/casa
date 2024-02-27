var util = require('util');
var Service = require('../service');
const request = require('request');

function WeatherService(_config, _owner) {
   Service.call(this, _config, _owner);
   this.clientSecret = _config.clientSecret;
   this.clientId = _config.clientId;
   this.apiKey = _config.apiKey;

   this.deviceTypes = {
      "current": "currentweather",
      "last24hours": "last24hoursweather",
      "lastweek": "lastweekweather"
   };

   this.devices = {};
}

util.inherits(WeatherService, Service);

// Called when current state required
WeatherService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
WeatherService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

WeatherService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

WeatherService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

WeatherService.prototype.fetchCurrentWeather = function(_serviceNode, _latitude, _longitude, _callback) {
   console.log(this.uName + ": Fetching current 3 hour forecast from the Met Office");

   const options = {
      method: 'GET',
      //url: 'https://api-metoffice.apiconnect.ibmcloud.com/metoffice/production/v0/forecasts/point/three-hourly',
      qs: {
         excludeParameterMetadata: true,
         includeLocationName: true,
         latitude: _latitude,
         longitude: _longitude
      },
      headers: {
         //'X-IBM-Client-Id': this.clientId,
         //'X-IBM-Client-Secret': this.clientSecret,
         accept: 'application/json'
      }
   };

   if (this.apiKey) {
      options.url = 'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/three-hourly';
      options.headers.apikey = this.apiKey;
   }
   else {
      options.url = 'https://api-metoffice.apiconnect.ibmcloud.com/metoffice/production/v0/forecasts/point/three-hourly';
      options.headers['X-IBM-Client-Id'] = this.clientId;
      options.headers['X-IBM-Client-Secret'] = this.clientSecret;
   }

   request(options, (_error, _response, _body) => {

     if (_error) {
        return _callback(_error);
     }

     try {
        _callback(null, JSON.parse(_body).features[0].properties.timeSeries[0]);
     }
     catch (_err) {
        _callback(_err);
     }
   });
};

module.exports = exports = WeatherService;
