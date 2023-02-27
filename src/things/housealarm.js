var util = require('util');
var HouseAlarmBase = require('./housealarmbase');

function HouseAlarm(_config, _parent) {
   HouseAlarmBase.call(this, _config, _parent);

   this.armModeConfigs = {
      "idle-disarmed": {
         zoneConfig: {
            name: "idle-disarmed", sources: [{ event: "idle-disarmed-confirm-event", action: { event: "zone-trigger-confirmed" }} ]},
         entryEventConfig: {
            name: "idle-disarmed-entry-event", sources: [], actions: [] },
         confirmEventConfig: {
            name: "idle-disarmed-confirm-event", confirmationInputs: 2, confirmationTimeout: 30,
            sources: [ { event: "idle-disarmed-entry-event"}] }},
      "stay-armed": {
         zoneConfig: {
            name: "stay-armed", sources: [{ event: "stay-armed-confirm-event", action: { event: "zone-trigger-confirmed" }} ]},
         entryEventConfig: {
            name: "stay-armed-entry-event", sources: [], actions: [] },
         confirmEventConfig: {
            name: "stay-armed-confirm-event", confirmationInputs: 2, confirmationTimeout: 30,
            sources: [ { event: "stay-armed-entry-event"}] }},
      "away-armed": {
         zoneConfig: {
            name: "away-armed", sources: [{ event: "away-armed-confirm-event", action: { event: "zone-trigger-confirmed" }} ]},
         entryEventConfig: {
             name: "away-armed-entry-event", sources: [], actions: [] },
         confirmEventConfig: {
            name: "away-armed-confirm-event", confirmationInputs: 2, confirmationTimeout: 30,
            sources: [ { event: "away-armed-entry-event"} ] }},
      "night-armed": {
         zoneConfig: {
            name: "night-armed", sources: [{ event: "night-armed-confirm-event", action: { event: "zone-trigger-confirmed" }} ]},
         entryEventConfig: {
            name: "night-armed-entry-event", sources: [], actions: [] },
         confirmEventConfig: {
            name: "night-armed-confirm-event", confirmationInputs: 2, confirmationTimeout: 30,
            sources: [ { event: "night-armed-entry-event"}] }} };

   // Zones                                                                  
   for (var i = 0; i < _config.zones.length; ++i) {                          
      this.ensurePropertyExists(_config.zones[i].name+"-zone-active", "property", { initialValue: false, source: _config.zones[i].activeSource }, _config);
                                                                           
      if (_config.zones[i].hasOwnProperty("tamperSource")) {                 
         this.ensurePropertyExists(_config.zones[i].name+"-zone-tamper", "property", { initialValue: false, source: _config.zones[i].tamperSource }, _config);
      }
   
      if (_config.zones[i].hasOwnProperty("armRule")) {

         if (_config.zones[i].armRule.mode === "always") {
            _config.zones[i].armRules = [ { mode: "idle-disarmed", role: _config.zones[i].armRule.role }, { mode: "stay-armed", role: _config.zones[i].armRule.role },
                                          { mode: "away-armed", role: _config.zones[i].armRule.role }, { mode: "night-armed", role: _config.zones[i].armRule.role } ];
         }
         else if (_config.zones[i].armRule.mode === "all-armed") {
            _config.zones[i].armRules = [ { mode: "stay-armed", role: _config.zones[i].armRule.role }, { mode: "away-armed", role: _config.zones[i].armRule.role },
                                          { mode: "night-armed", role: _config.zones[i].armRule.role } ];
         }
         else {
            _config.zones[i].armRules = [ _config.zones[i].armRule ];
         }
                                                                        
         delete _config.zones[i].armRule;
      }

      for (var j = 0; j < _config.zones[i].armRules.length; ++j) {                
                                                                                  
         if (this.armModeConfigs.hasOwnProperty(_config.zones[i].armRules[j].mode)) {
            var armModeConfig = this.armModeConfigs[_config.zones[i].armRules[j].mode];
            var newSource = util.copy(_config.zones[i].activeSource);
            newSource.action = { event: (_config.zones[i].armRules[j].role === "guard") ? "zone-triggered" : "zone-entered" };
            armModeConfig.zoneConfig.sources.push(newSource);

            if (_config.zones[i].armRules[j].role === "entry") {
               armModeConfig.entryEventConfig.sources.push(_config.zones[i].activeSource);
               armModeConfig.entryEventConfig.sources[armModeConfig.entryEventConfig.sources.length - 1].value = true;
            }
            else if (_config.zones[i].armRules[j].role === "guard") {
               armModeConfig.confirmEventConfig.sources.push(_config.zones[i].activeSource);
               armModeConfig.confirmEventConfig.sources[armModeConfig.confirmEventConfig.sources.length - 1].value = true;
            }
         }
      }
   }

   this.ensurePropertyExists("alarm-state-zones", "stateproperty", { source: { property: "alarm-state" },
                                                                     states: [ this.armModeConfigs["idle-disarmed"].zoneConfig, this.armModeConfigs["stay-armed"].zoneConfig,
                                                                               this.armModeConfigs["away-armed"].zoneConfig, this.armModeConfigs["night-armed"].zoneConfig ] }, _config);

   this.ensureEventExists("idle-disarmed-entry-event", "event", this.armModeConfigs["idle-disarmed"].entryEventConfig, _config);
   this.ensureEventExists("stay-armed-entry-event", "event", this.armModeConfigs["stay-armed"].entryEventConfig, _config);
   this.ensureEventExists("away-armed-entry-event", "event", this.armModeConfigs["away-armed"].entryEventConfig, _config);
   this.ensureEventExists("night-armed-entry-event", "event", this.armModeConfigs["night-armed"].entryEventConfig, _config);

   this.ensureEventExists("idle-disarmed-confirm-event", "confirmevent", this.armModeConfigs["idle-disarmed"].confirmEventConfig, _config);
   this.ensureEventExists("stay-sarmed-confirm-event", "confirmevent", this.armModeConfigs["stay-armed"].confirmEventConfig, _config);
   this.ensureEventExists("away-sarmed-confirm-event", "confirmevent", this.armModeConfigs["away-armed"].confirmEventConfig, _config);
   this.ensureEventExists("night-sarmed-confirm-event", "confirmevent", this.armModeConfigs["night-armed"].confirmEventConfig, _config);
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
