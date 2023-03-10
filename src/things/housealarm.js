var util = require('util');
var Thing = require('../thing');

function HouseAlarmBase(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.ensurePropertyExists("max-retries", "property", { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists("retry-count", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("retry-allowed", "evalproperty", { initialValue: true,
                                                                sources: [{ property: "retry-count" }, { property: "max-retries" }],
                                                                expression: "($values[0] < $values[1])" }, _config);

   var defaultTimeouts = { exit: 30, entry: 30, triggered: 120 };
   this.modes = {};

   // Set timeouts
   for (var i = 0; i < _config.modes.length; ++i) {
      var mode = _config.modes[i];

      if (!mode.hasOwnProperty("exitTimeout")) mode.exitTimeout = defaultTimeouts.exit; 
      if (!mode.hasOwnProperty("entryTimeout")) mode.entryTimeout = defaultTimeouts.entry;
      if (!mode.hasOwnProperty("triggeredTimeout")) mode.triggeredTimeout = defaultTimeouts.triggered;

      this.ensurePropertyExists(mode.name+"-exit-timeout", "property", { initialValue: mode.exitTimeout }, _config);
      this.ensurePropertyExists(mode.name+"-entry-timeout", "property", { initialValue: mode.entryTimeout }, _config);
      this.ensurePropertyExists(mode.name+"-triggered-timeout", "property", { initialValue: mode.triggeredTimeout }, _config);

      this.ensurePropertyExists(mode.name+"-armed", "property",
                                { initialValue: false,
                                  source: { property: "alarm-state",
                                            transform: "($value === \""+mode.name+"-armed\") || ($value === \""+mode.name+"-entry\") || ($value === \""+mode.name+"-triggered\") || ($value === \""+mode.name+"-confirmed\")" }}, _config);
   }

   // Internal - current timeouts based on arm state selected
   this.ensurePropertyExists("exit-timeout", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("entry-timeout", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("triggered-timeout", "property", { initialValue: 120 }, _config);
   this.ensurePropertyExists("last-active-zone", "property", { initialValue: "" }, _config);

   this.ensurePropertyExists("target-state", "property", { initialValue: "disarmed" }, _config);
   this.ensurePropertyExists("current-state", "property", { initialValue: "disarmed" }, _config);

   // Alarm status properties
   this.ensurePropertyExists("fire-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("medical-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("panic-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("duress-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("attack-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("carbon-monoxide-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("tamper-alarm", "property", { initialValue: false }, _config);

   this.ensurePropertyExists("in-exit-entry", "property", { initialValue: false, source: { property: "arm-state", transform: "($value === \"entry\") || ($value === \"exit\")" }}, _config);
   this.ensurePropertyExists("zone-alarm", "property", { initialValue: false, source: { property: "arm-state", transform: "($value === \"triggered\") || ($value === \"confirmed\")" }}, _config);

   this.ensurePropertyExists("confirmed-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("alarm-error", "property", { initialValue: "" }, _config);
   this.ensurePropertyExists("entry-zone-active", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("guard-zone-active", "property", { initialValue: false }, _config);


   // Internal properties
   this.ensurePropertyExists("target-arm-state", "property", { initialValue: "disarmed" }, _config);

   // Core state machines
   var armModeConfig = { name: "arm-mode-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "idle",
                         states: [{ name: "idle",
                                    sources: [{ property: "tamper-alarm", value: true, nextState: "tamper" },
                                              { property: "panic-alarm", value: true, nextState: "panic" } ]},
                                   { name: "tamper",
                                     sources: [{ property: "tamper-alarm", value: false, nextState: "idle" }]},
                                   { name: "panic",
                                     sources: [{ property: "panic-alarm", value: false, nextState: "idle" }]}]};

   for (var k = 0; k < _config.modes.length; ++k) {
      var mode = _config.modes[k];
      armModeConfig.states[0].sources.push({ property: "target-state", value: mode.name, nextState: "pre-"+mode.name });
      armModeConfig.states.push({ name: "pre-"+mode.name, 
                                  actions: [{ property: "exit-timeout", fromProperty: mode.name+"-exit-timeout" },
                                            { property: "entry-timeout", fromProperty: mode.name+"-entry-timeout" },
                                            { property: "triggered-timeout", fromProperty: mode.name+"-triggered-timeout" },
                                            { property: "entry-zone-active", value: false },
                                            { property: "guard-zone-active", value: false }],
                                  timeout: { duration: 0.1, nextState: mode.name }});

      armModeConfig.states.push({ name: mode.name, actions: [{ property: "target-arm-state", value: "armed" }] });
   }

   this.ensurePropertyExists("arm-mode-state", "stateproperty", armModeConfig, _config);

   this.ensurePropertyExists("arm-state", "stateproperty", { name: "arm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "disarmed",
                                                             states: [{ name: "disarmed",
                                                                        sources: [{ property: "target-arm-state", value: "armed", nextState: "exit" }],
                                                                        actions: [{ property: "retry-count", value: 0 },
                                                                                  { property: "entry-zone-active", value: false },
                                                                                  { property: "guard-zone-active", value: false },
                                                                                  { property: "confirmed-alarm", value: false },
                                                                                  { property: "arm-mode-state", value: "idle" },
                                                                                  { property: "current-state", value: "disarmed" }]},
                                                                      { name: "exit",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                                                  { property: "guard-zone-active", value: true, nextState: "triggered" }],
                                                                        timeout: { property: "exit-timeout", nextState: "armed" }},
                                                                      { name: "armed",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                                                  { property: "entry-zone-active", value: true, nextState: "entry" },
                                                                                  { property: "guard-zone-active", value: true, nextState: "triggered" }]},
                                                                      { name: "entry",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                                                  { property: "guard-zone-active", value: true, nextState: "triggered" }],
                                                                        timeout: { property: "entry-timeout", nextState: "triggered" }},
                                                                      { name: "triggered",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                                                  { event: "confirm-event", nextState: "confirmed" },
                                                                                  { property: "confirmed-alarm", value: true, nextState: "confirmed" }],
                                                                        actions: [{ property: "retry-count", apply: "++$value" },
                                                                                  { property: "current-state", value: "triggered" }],
                                                                        timeout: { property: "triggered-timeout", nextState: "triggered-timed-out" }},
                                                                      { name: "confirmed",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "reset-to-disarmed" }],
                                                                        actions: [{ property: "confirmed-alarm", value: true },
                                                                                  { property: "current-state", value: "confirmed" }],
                                                                        timeout: { from: [ "triggered" ], nextState: "triggered-timed-out" }},
                                                                      { name: "reset-to-disarmed",
                                                                        actions: [{ property: "target-arm-state", value: "disarmed" },
                                                                                  { property: "entry-zone-active", value: false },
                                                                                  { property: "guard-zone-active", value: false }],
                                                                        timeout: { duration: 0.1, nextState: "disarmed" }},
                                                                      { name: "triggered-timed-out",
                                                                        action: { property: "guard-zone-active", value: false },
                                                                        sources: [{ property: "retry-allowed", value: false,
                                                                                    action: { property: "target-state", value: "disarmed" }, nextState: "reset-to-disarmed" }],
                                                                        timeout: { duration: 0.1, nextState: "armed" }}]}, _config);

   // Bring in the zones with their desired arm modes
   var modeConfigs = {};

   for (var i = 0; i < _config.modes.length; ++i) {
      var mode = _config.modes[i];
      modeConfigs[mode.name] = { guardSources: [], entrySources: [] };
   }

   modeConfigs["disarmed"] = { guardSources: [], entrySources: [] };

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
            var source = util.copy(_config.zones[i].activeSource, true);

            if (_config.zones[i].armRules[j].role === "entry") {
               modeConfig.entrySources.push(source);
            }
            else if (_config.zones[i].armRules[j].role === "guard") {
               source.count = true;
               source.value = true;
               source.action = { property: "guard-zone-active", value: true };
               modeConfig.guardSources.push(source);
            }
         }
      }
   }

   var alarmConfig = { name: "alarm-state", type: "combinestateproperty", ignoreControl: true, takeControlOnTransition: true, separator: "-",
                       sources: [{ property: "arm-mode-state" }, { property: "arm-state" }],
                       states: [{ name: "idle-disarmed", sources: modeConfigs["disarmed"].guardSources }] };

   for (var l = 0; l < _config.modes.length; ++l) {
      mode = _config.modes[l];
      modeConfigs[mode.name].guardSources.push({ property: mode.name+"-entry-zone-active", count: false,
                                                 action: { property: "entry-zone-active", fromProperty: mode.name+"-entry-zone-active" }});

      alarmConfig.states.push({ name: mode.name+"-exit", sources: modeConfigs[mode.name].guardSources,
                                action: { property: "entry-zone-active", fromProperty: mode.name+"-entry-zone-active" } });
      alarmConfig.states.push({ name: mode.name+"-entry", sources: modeConfigs[mode.name].guardSources,
                                action: { property: "entry-zone-active", fromProperty: mode.name+"-entry-zone-active" } });
      alarmConfig.states.push({ name: mode.name+"-armed", sources: modeConfigs[mode.name].guardSources,
                                actions: [{ property: "current-state", value: mode.name },
                                          { property: "entry-zone-active", fromProperty: mode.name+"-entry-zone-active" } ] });

      alarmConfig.states.push({ name: mode.name+"-triggered", sources: modeConfigs[mode.name].guardSources,
                                action: { property: "entry-zone-active", fromProperty: mode.name+"-entry-zone-active" },
                                counter: { "unique": true, "from": [ mode.name+"-armed" ], "limit": 2, "action": { "event": "confirm-event" }} });

      this.ensurePropertyExists(mode.name+"-entry-zone-active", "orproperty", { initialValue: false, sources: modeConfigs[mode.name].entrySources }, _config);
   }

   this.ensurePropertyExists("alarm-state", "combinestateproperty", alarmConfig, _config);
}

util.inherits(HouseAlarmBase, Thing);

// Called when system state is required
HouseAlarmBase.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HouseAlarmBase.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HouseAlarmBase.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this); 
};

HouseAlarmBase.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = HouseAlarmBase;
