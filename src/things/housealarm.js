var util = require('util');
var HouseAlarmBase = require('./housealarmbase');

function HouseAlarm(_config, _parent) {
   HouseAlarmBase.call(this, _config, _parent);

   this.stayArmZonesConfig = { name: "stay-armed", sources: [], actions: [] };
   this.awayArmZonesConfig = { name: "away-armed", sources: [], actions: [] };
   this.nightArmZonesConfig = { name: "night-armed", sources: [], actions: [] };

   const armTypeMap = { stay: this.stayArmZonesConfig, away: this.awayArmZonesConfig, night: this.nightArmZonesConfig };

   for (var i = 0; i < _config.zones.length; ++i) {
      this.ensurePropertyExists(_config.zones[i].name+"-zone", "property", { initialValue: false, source: _config.zones[i].source }, _config);

      if (_config.zones[i].hasOwnProperty("armModes") {
         _config.zones[i].armModes = [ _config.zones[i].armMode ];
         delete _config.zones[i].armMode;
      }

      for (var j = 0; j < _config.zones[i].armModes.length; ++j) {

         if (armTypeMap.hasOwnProperty(_config.zones[i].armModes[j].armType)) {
            armTypeMap[_config.zones[i].armModes[j].armType].sources.push(_config.zones[i].source);
            armTypeMap[_config.zones[i].armModes[j].armType].actions.push({ event: (_config.zones[i].armModes[j].zoneType === "guard") ? "zone-triggered" : "zone-entered"});
         }
      }
   }

   this.ensurePropertyExists("alarm-state", "stateproperty", { states: [ this.stayArmZonesConfig, this.awayArmZonesConfig, this.nightArmZoneConfig ] }, _config);
}

util.inherits(HouseAlarm, HouseAlarmBase);

// Called when system state is required
HouseAlarm.prototype.export = function(_exportObj) {
   HouseAlarmBase.prototype.export.call(this, _exportObj);
};

// Called when current state required
HouseAlarm.prototype.import = function(_importObj) {
   HouseAlarmBase.prototype.import.call(this, _importObj);
};

HouseAlarm.prototype.coldStart = function() {
   HouseAlarmBase.prototype.coldStart.call(this); 
};

HouseAlarm.prototype.hotStart = function() {
   HouseAlarmBase.prototype.hotStart.call(this);
};

module.exports = exports = HouseAlarm;
