var util = require('util');
var Thing = require('../thing');

function HouseAlarm(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.mainSentry = _config.mainSentry;

   this.ensurePropertyExists("alarm-error", "property", { source: { property: this.mainSentry+"-alarm-error" }}, _config);
   this.ensurePropertyExists("current-state", "property", { source: { property: this.mainSentry+"-current-state", transform: "($value === \"confirmed\") ? \"triggered\" : $value" }}, _config);
   this.ensurePropertyExists("target-state", "property", { initialValue: "disarmed" }, _config);

   for (var i = 0; i < _config.sentries.length; ++i) {
      this.createSentry(_config.sentries[i], _config, _config.sentries[i].name === this.mainSentry);
   }
}

util.inherits(HouseAlarm, Thing);

HouseAlarm.prototype.createSentry = function(_config, _mainConfig, _mainSentry) {
   var defaultTimeouts = { exit: 0, entry: 0, triggered: 120 };
   this.ensurePropertyExists(_config.name+"-max-retries", "property", { initialValue: _mainConfig.hasOwnProperty("maxRetries") ? _mainConfig.maxRetries : 2 }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-retry-count", "property", { initialValue: 0 }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-retry-allowed", "evalproperty", { initialValue: true,
                                                                              sources: [{ property: _config.name+"-retry-count" }, { property: _config.name+"-max-retries" }],
                                                                              expression: "($values[0] < $values[1])" }, _mainConfig);
   // Set timeouts
   for (var i = 0; i < _config.armModes.length; ++i) {
      var mode = _config.armModes[i];

      if (!mode.hasOwnProperty("exitTimeout")) mode.exitTimeout = defaultTimeouts.exit; 
      if (!mode.hasOwnProperty("entryTimeout")) mode.entryTimeout = defaultTimeouts.entry;
      if (!mode.hasOwnProperty("triggeredTimeout")) mode.triggeredTimeout = defaultTimeouts.triggered;

      this.ensurePropertyExists(_config.name+"-"+mode.name+"-exit-timeout", "property", { initialValue: mode.exitTimeout }, _mainConfig);
      this.ensurePropertyExists(_config.name+"-"+mode.name+"-entry-timeout", "property", { initialValue: mode.entryTimeout }, _mainConfig);
      this.ensurePropertyExists(_config.name+"-"+mode.name+"-triggered-timeout", "property", { initialValue: mode.triggeredTimeout }, _mainConfig);

      this.ensurePropertyExists(_config.name+"-"+mode.name+"-armed", "property",
                                { initialValue: false,
                                  source: { property: _config.name+"-alarm-state",
                                            transform: "($value === \""+mode.name+"-armed\") || ($value === \""+mode.name+"-entry\") || \
                                                        ($value === \""+mode.name+"-triggered\") || ($value === \""+mode.name+"-triggered-timed-out\") || \
                                                        ($value === \""+mode.name+"-confirmed\")" }}, _mainConfig);
   }

   // Internal - current timeouts based on arm state selected
   this.ensurePropertyExists(_config.name+"-exit-timeout", "property", { initialValue: 0 }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-entry-timeout", "property", { initialValue: 0 }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-triggered-timeout", "property", { initialValue: 120 }, _mainConfig);

   if (_mainSentry) {
      this.ensurePropertyExists(_config.name+"-target-state", "property", { source: { property: "target-state" }}, _mainConfig);
   }
   else {
      this.ensurePropertyExists(_config.name+"-target-state", "property", { initialValue: "disarmed" }, _mainConfig);
   }

   this.ensurePropertyExists(_config.name+"-current-state", "property", { initialValue: "disarmed" }, _mainConfig);

   // Alarm status properties
   this.ensurePropertyExists(_config.name+"-alarm", "property", { initialValue: false }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-in-exit-entry", "property",
                             { initialValue: false, source: { property: _config.name+"-"+"arm-state", transform: "($value === \"entry\") || ($value === \"exit\")" }}, _mainConfig);

   this.ensurePropertyExists(_config.name+"-zone-alarm", "property",
                             { initialValue: false,
                               source: { property: _config.name+"-"+"arm-state",
                                         transform: "($value === \"triggered\") || ($value === \"confirmed\") || ($value === \"triggered-timed-out\")" }}, _mainConfig);

   this.ensurePropertyExists(_config.name+"-confirmed-alarm", "property", { initialValue: false }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-entry-zone-active", "property", { initialValue: false }, _mainConfig);
   this.ensurePropertyExists(_config.name+"-guard-zone-active", "property", { initialValue: false }, _mainConfig);

   // Internal properties
   this.ensurePropertyExists(_config.name+"-target-arm-state", "property", { initialValue: "disarmed" }, _mainConfig);

   // Core state machines
   var armModeConfig = { type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "idle",
                         states: [{ name: "idle", sources: [] }] };

   for (var k = 0; k < _config.armModes.length; ++k) {
      var mode = _config.armModes[k];
      armModeConfig.states[0].sources.push({ property: _config.name+"-target-state", value: mode.name, nextState: "pre-"+mode.name });
      armModeConfig.states.push({ name: "pre-"+mode.name, 
                                  actions: [{ property: _config.name+"-exit-timeout", fromProperty: _config.name+"-"+mode.name+"-exit-timeout" },
                                            { property: _config.name+"-entry-timeout", fromProperty: _config.name+"-"+mode.name+"-entry-timeout" },
                                            { property: _config.name+"-triggered-timeout", fromProperty: _config.name+"-"+mode.name+"-triggered-timeout" },
                                            { property: _config.name+"-entry-zone-active", value: false },
                                            { property: _config.name+"-guard-zone-active", value: false }],
                                  timeout: { duration: 0.1, nextState: mode.name }});

      armModeConfig.states.push({ name: mode.name, actions: [{ property: _config.name+"-target-arm-state", value: "armed" }] });
   }

   this.ensurePropertyExists(_config.name+"-arm-mode-state", "stateproperty", armModeConfig, _mainConfig);

   var armStateConfig = { name: "arm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "disarmed",
                          states: [{ name: "disarmed",
                                     sources: [{ property: _config.name+"-target-arm-state", value: "armed", nextState: "exit" }],
                                     actions: [{ property: _config.name+"-retry-count", value: 0 },
                                               { property: _config.name+"-entry-zone-active", value: false },
                                               { property: _config.name+"-guard-zone-active", value: false },
                                               { property: _config.name+"-confirmed-alarm", value: false },
                                               { property: _config.name+"-arm-mode-state", value: "idle" },
                                               { property: _config.name+"-current-state", value: "disarmed" }]},
                                    { name: "exit",
                                      sources: [{ property: _config.name+"-target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                { property: _config.name+"-guard-zone-active", value: true, nextState: "triggered" }],
                                                timeout: { property: _config.name+"-exit-timeout", nextState: "armed" }},
                                    { name: "armed",
                                      sources: [{ property: _config.name+"-target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                { property: _config.name+"-entry-zone-active", value: true, nextState: "entry" },
                                                { property: _config.name+"-guard-zone-active", value: true, nextState: "triggered" }]},
                                    { name: "entry",
                                      sources: [{ property: _config.name+"-target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                { property: _config.name+"-guard-zone-active", value: true, nextState: "triggered" }],
                                      timeout: { property: _config.name+"-entry-timeout", nextState: "triggered" }},
                                    { name: "triggered",
                                      sources: [{ property: _config.name+"-target-state", value: "disarmed", nextState: "reset-to-disarmed" },
                                                { event: _config.name+"-confirm-event", nextState: "confirmed" },
                                                { property: _config.name+"-confirmed-alarm", value: true, nextState: "confirmed" }],
                                      actions: [{ property: _config.name+"-retry-count", apply: "++$value" },
                                                { property: _config.name+"-current-state", value: "triggered" }],
                                      timeout: { property: _config.name+"-triggered-timeout", nextState: "triggered-timed-out" }},
                                    { name: "confirmed",
                                      sources: [{ property: _config.name+"-target-state", value: "disarmed", nextState: "reset-to-disarmed" }],
                                      actions: [{ property: _config.name+"-confirmed-alarm", value: true },
                                                { property: _config.name+"-current-state", value: "confirmed" }],
                                      timeout: { from: [ "triggered" ], nextState: "triggered-timed-out" }},
                                    { name: "reset-to-disarmed",
                                      actions: [{ property: _config.name+"-target-arm-state", value: "disarmed" },
                                                { property: _config.name+"-entry-zone-active", value: false },
                                                { property: _config.name+"-guard-zone-active", value: false }],
                                      timeout: { duration: 0.1, nextState: "disarmed" }},
                                    { name: "triggered-timed-out",
                                      action: { property: _config.name+"-guard-zone-active", value: false },
                                      sources: [{ property: _config.name+"-retry-allowed", value: false,
                                                  action: { property: _config.name+"-target-state", value: "disarmed" }, nextState: "reset-to-disarmed" }],
                                      timeout: { duration: 0.1, nextState: "armed" }}]};

   if (_config.hasOwnProperty("autoArmIn")) {
      armStateConfig.states[0].sources.push({ property: _config.name+"-"+_config.autoArmIn+"-all-guards-passive", value: false,
                                              action: { property: _config.name+"-target-state", value: _config.autoArmIn }});
   }

   this.ensurePropertyExists(_config.name+"-arm-state", "stateproperty", armStateConfig, _mainConfig);
   
   var modeConfigs = {};

   for (var i = 0; i < _config.armModes.length; ++i) {
      var mode = _config.armModes[i];
      modeConfigs[mode.name] = { guardSources: [], entrySources: [], guardSources2: mode.guards };

      if (mode.hasOwnProperty("guards")) {

         // Bring in the guards
         for (var j = 0; j < mode.guards.length; ++j) {
            var source = util.copy(mode.guards[j], true);
            source.count = true;
            source.value = true;
            source.action = { property: _config.name+"-guard-zone-active", value: true };
            modeConfigs[mode.name].guardSources.push(source);
         }
      }

      if (mode.hasOwnProperty("entries")) {

         // Bring in the entries
         for (var k = 0; k < mode.entries.length; ++k) {
            modeConfigs[mode.name].entrySources.push(mode.entries[k]);
         }
      }
   }

   var alarmConfig = { type: "combinestateproperty", ignoreControl: true, takeControlOnTransition: true, separator: "-",
                       sources: [{ property: _config.name+"-arm-mode-state" }, { property: _config.name+"-arm-state" }],
                       states: [] };

   for (var l = 0; l < _config.armModes.length; ++l) {
      mode = _config.armModes[l];
      modeConfigs[mode.name].guardSources.push({ property: _config.name+"-"+mode.name+"-entry-zone-active", count: false,
                                                 action: { property: _config.name+"-entry-zone-active", fromProperty: _config.name+"-"+mode.name+"-entry-zone-active" }});

      alarmConfig.states.push({ name: mode.name+"-exit", sources: modeConfigs[mode.name].guardSources,
                                action: { property: _config.name+"-entry-zone-active", fromProperty: _config.name+"-"+mode.name+"-entry-zone-active" }});


      alarmConfig.states.push({ name: mode.name+"-entry", sources: modeConfigs[mode.name].guardSources,
                                action: { property: _config.name+"-entry-zone-active", fromProperty: _config.name+"-"+mode.name+"-entry-zone-active" }});

      alarmConfig.states.push({ name: mode.name+"-armed", sources: modeConfigs[mode.name].guardSources,
                                actions: [{ property: _config.name+"-current-state", value: mode.name },
                                          { property: _config.name+"-entry-zone-active", fromProperty: _config.name+"-"+mode.name+"-entry-zone-active" } ]});

      alarmConfig.states.push({ name: mode.name+"-triggered", sources: modeConfigs[mode.name].guardSources,
                                action: { property: _config.name+"-entry-zone-active", fromProperty: _config.name+"-"+mode.name+"-entry-zone-active" } });

      if (_config.hasOwnProperty("confirmCount")) {
         var index = alarmConfig.states.length - 4;
         alarmConfig.states[index].counter = { "unique": true, "limit": _config.confirmCount, "action": { "event": _config.name+"-confirm-event" }};
         alarmConfig.states[index+1].counter = { "unique": true, "limit": _config.confirmCount, "action": { "event": _config.name+"-confirm-event" }};
         alarmConfig.states[index+2].counter = { "unique": true, "limit": _config.confirmCount, "action": { "event": _config.name+"-confirm-event" }};
         alarmConfig.states[index+3].counter = { "unique": true, "from": [ mode.name+"-armed", mode.name+"-entry", mode.name+"-exit" ],
                                                 "limit": _config.confirmCount, "action": { "event": _config.name+"-confirm-event" }};
      }

      this.ensurePropertyExists(_config.name+"-"+mode.name+"-entry-zone-active", "orproperty", { initialValue: false, sources: modeConfigs[mode.name].entrySources }, _mainConfig);

      if (modeConfigs[mode.name].guardSources2) {
         this.ensurePropertyExists(_config.name+"-"+mode.name+"-all-guards-passive", "orproperty", { initialValue: false, sources: modeConfigs[mode.name].guardSources2 }, _mainConfig);
      }
   }

   this.ensurePropertyExists(_config.name+"-alarm-state", "combinestateproperty", alarmConfig, _mainConfig);
}

// Called when system state is required
HouseAlarm.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
HouseAlarm.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

HouseAlarm.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this); 
};

HouseAlarm.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = HouseAlarm;
