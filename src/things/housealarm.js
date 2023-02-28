var util = require('util');
var HouseAlarmBase = require('./housealarmbase');

function HouseAlarm(_config, _parent) {
   HouseAlarmBase.call(this, _config, _parent);

   var modeConfigs = {};

   for (var i = 0; i < _config.modes.length; ++i) {
      var mode = _config.modes[i];
      modeConfigs[mode.name] = { guardConfig: { name: mode.name+"-armed-guard-zone-active", initialValue: false, sources: [] },
                                 entryConfig: { name: mode.name+"-armed-entry-zone-active", initialValue: false, sources: [] },
                                 confirmEventConfig: { name: mode.name+"-armed-confirm-event", type: "confirmEvent", confirmationInputs: 2, confirmationTimeout: 30,
                                                       sources: [ { event: mode.name+"-armed-entry-event" }] } };
   }

   modeConfigs["disarmed"] = { guardConfig: { name: "idle-disarmed-guard-zone-active", initialValue: false, sources: [] },
                               entryConfig: { name: "idle-disarmed-entry-zone-active", initialValue: false, sources: [] },
                               confirmEventConfig: { name: "idle-disarmed-confirm-event", type: "confirmEvent", confirmationInputs: 2, confirmationTimeout: 30,
                                                     sources: [ { event: "idle-disarmed-entry-event" }] } };

   // Zones                                                                  
   for (var i = 0; i < _config.zones.length; ++i) {                          
      this.ensurePropertyExists(_config.zones[i].name+"-zone-active", "property", { initialValue: false, source: _config.zones[i].activeSource }, _config);
                                                                           
      if (_config.zones[i].hasOwnProperty("tamperSource")) {                 
         this.ensurePropertyExists(_config.zones[i].name+"-zone-tamper", "property", { initialValue: false, source: _config.zones[i].tamperSource }, _config);
      }
   
      if (_config.zones[i].hasOwnProperty("armRule")) {

         if (_config.zones[i].armRule.mode === "always") {
            _config.zones[i].armRules = [ { mode: "disarmed", role: _config.zones[i].armRule.role }, { mode: "stay", role: _config.zones[i].armRule.role },
                                          { mode: "away", role: _config.zones[i].armRule.role }, { mode: "night", role: _config.zones[i].armRule.role } ];
         }
         else if (_config.zones[i].armRule.mode === "all-armed") {
            _config.zones[i].armRules = [ { mode: "stay", role: _config.zones[i].armRule.role }, { mode: "away", role: _config.zones[i].armRule.role },
                                          { mode: "night", role: _config.zones[i].armRule.role } ];
         }
         else {
            _config.zones[i].armRules = [ _config.zones[i].armRule ];
         }
                                                                        
         delete _config.zones[i].armRule;
      }

      for (var j = 0; j < _config.zones[i].armRules.length; ++j) {                
                                                                                  
         if (modeConfigs.hasOwnProperty(_config.zones[i].armRules[j].mode)) {
            var modeConfig = modeConfigs[_config.zones[i].armRules[j].mode];

            if (_config.zones[i].armRules[j].role === "entry") {
               modeConfig.entryConfig.sources.push(_config.zones[i].activeSource);
            }
            else if (_config.zones[i].armRules[j].role === "guard") {
               modeConfig.guardConfig.sources.push(_config.zones[i].activeSource);

               modeConfig.confirmEventConfig.sources.push(util.copy(_config.zones[i].activeSource, true));
               modeConfig.confirmEventConfig.sources[modeConfig.confirmEventConfig.sources.length - 1].value = true;
            }
         }
      }
   }

   this.ensurePropertyExists("idle-disarmed-guard-zone-active", "orproperty", modeConfigs["disarmed"].guardConfig, _config);
   this.ensurePropertyExists("idle-disarmed-entry-zone-active", "orproperty", modeConfigs["disarmed"].entryConfig, _config);
   this.ensureEventExists("idle-disarmed-confirm-event", "confirmevent", modeConfigs["disarmed"].confirmEventConfig, _config);

   for (i = 0; i < _config.modes.length; ++i) {
      var mode = _config.modes[i];

      this.ensurePropertyExists(mode.name+"-armed-guard-zone-active", "orproperty", modeConfigs[mode.name].guardConfig, _config);
      this.ensurePropertyExists(mode.name+"-armed-entry-zone-active", "orproperty", modeConfigs[mode.name].entryConfig, _config);
      this.ensureEventExists(mode.name+"-sarmed-confirm-event", "confirmevent", modeConfigs[mode.name].confirmEventConfig, _config);
   }
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
