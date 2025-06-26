var util = require('util');
const axios = require('axios');
const SunCalc = require('suncalc');
const Thing = require('../thing');
const Gang = require('../gang');

// Please provide inputs
// users - users that will be at the location

// Please define the following properties
// latitude - Location of the building
// longitude - Location of the building

function SimOutdoorLightSensor(_config, _owner) {
   Thing.call(this, _config, _owner);
   this.thingType = "simoutdoorlightsensor";
   const rules = _config.hasOwnProperty("scheduleRule") ? [config.scheduleRule] : (_config.hasOwnProperty("scheduleRules") ? config.scheduleRules : [{ rule: "0,10,20,30,40,50 * * * *" }]);

   const scheduleServiceName = this.gang.casa.findServiceName("scheduleservice");

   if (!scheduleServiceName) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }

   this.scheduleService = this.gang.casa.findService(scheduleServiceName);

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit(1);
   }

   this.ensurePropertyExists("light-level", "property", { initialValue: 0 }, _config);

   if (_config.hasOwnProperty("latitude")) {
      this.ensurePropertyExists("latitude", "property", { initialValue: _config.latitude }, _config);
   }

   if (_config.hasOwnProperty("longitude")) {
      this.ensurePropertyExists("longitude", "property", { initialValue: _config.longitude }, _config);
   }

   this.scheduleService.registerEvents(this, rules);
}

util.inherits(SimOutdoorLightSensor, Thing);

// Called when system state is required
SimOutdoorLightSensor.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
SimOutdoorLightSensor.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
SimOutdoorLightSensor.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

// Called to start a cold system
SimOutdoorLightSensor.prototype.coldStart = function () {
   Thing.prototype.coldStart.call(this);
   this.scheduledEventTriggered();
};

SimOutdoorLightSensor.prototype.scheduledEventTriggered = function(_event) {

   if (!this.bowing) {
      var lat = this.getProperty("latitude");
      var lon = this.getProperty("longitude");

      getCurrentCloudCover(lat, lon, (_err, _cloudCover) => {

         if (_err) {
           console.error(this.uName + ": Failed to get current cloud cover. Error="+_err);
           return;
         }

         console.log(this.uName + ": Cloud cover estimated at " + _cloudCover);

         const lightLevel = estimateLightLevel(lat, lon, new Date(), _cloudCover);
         this.alignPropertyValue("light-level", lightLevel);
      });
   }
};

/**
 * Fetch current cloud cover (0–1) from Open-Meteo
 */
function getCurrentCloudCover(_lat, _lon, _callback) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${_lat}&longitude=${_lon}&current=cloud_cover`;

  axios.get(url)
  .then( (_response) => {
     const cloudPercent = _response.data.current.cloud_cover;
     console.log("AAAAAAAAAAAAAAAAAA cloudCoverPercen"+cloudPercent);

     if (typeof cloudPercent !== 'number') {
       _callback("Cloud cover not found in response.");
     }

     _callback(null, cloudPercent / 100);
  })
  .catch( (_error) => {
     _callback(_error);
  })
}

/**
 * Estimate outdoor light level (0–100) based on sun elevation + cloud cover
 */
function estimateLightLevel(lat, lon, date = new Date(), cloudCover = 0) {
  const sunPos = SunCalc.getPosition(date, lat, lon);
  const elevation = sunPos.altitude * (180 / Math.PI); // Radians → Degrees

  let baseLight = 0;

  if (elevation <= -6) {
    baseLight = 0; // night
  } else if (elevation > -6 && elevation <= 0) {
    baseLight = 20 * (elevation + 6) / 6;
  } else if (elevation > 0 && elevation < 45) {
    baseLight = 20 + 60 * (elevation / 45);
  } else {
    baseLight = 80 + 20 * ((elevation - 45) / 45);
  }

  const elevationFactor = Math.max(0, Math.min(1, elevation / 90));
  const cloudImpact = 0.35 - 0.33 * elevationFactor;

  const adjusted = baseLight * (1 - cloudCover * cloudImpact);
  return Math.round(Math.max(0, Math.min(100, adjusted)));

}

module.exports = exports = SimOutdoorLightSensor;
