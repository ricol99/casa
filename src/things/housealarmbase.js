var util = require('util');
var Thing = require('../thing');

var STATE_STAY_ARM = 0;
var STATE_AWAY_ARM = 1;
var STATE_NIGHT_ARM = 2;
var STATE_DISARMED = 3;
var STATE_ALARM_TRIGGERED = 4;

function HouseAlarmBase(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.stayArmZones = {};
   this.awayArmZones = {};
   this.nightArmZones = {};

   this.ensurePropertyExists("max-retries", "property", { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists("retry-count", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("retry-allowed", "evalproperty", { initialValue: true,
                                                                sources: [{ property: "retry-count" }, { property: "max-retries" }],
                                                                expression: "($values[0] < $values[1])" }, _config);

   var timeouts = { exit: { stay: 0, away: 30, night: 30 }, entry: { stay: 0, away: 30, night: 30 }, triggered: { stay: 120, away: 120, night: 60 }}; 

   if (_config.hasOwnProperty("exitTimeout")) {
      timeouts.exit.stay = _config.exitTimeout;
      timeouts.exit.away = _config.exitTimeout;
      timeouts.exit.night = _config.exitTimeout;
   }

   if (_config.hasOwnProperty("entryTimeout")) {
      timeouts.entry.stay = _config.entryTimeout;
      timeouts.entry.away = _config.entryTimeout;
      timeouts.entry.night = _config.entryTimeout;
   }

   if (_config.hasOwnProperty("triggeredTimeout")) {
      timeouts.triggered.stay = _config.triggeredTimeout;
      timeouts.triggered.away = _config.triggeredTimeout;
      timeouts.triggered.night = _config.triggeredTimeout;
   }

   if (_config.hasOwnProperty("stayExitTimeout")) timeouts.exit.stay = _config.stayExitTimeout;
   if (_config.hasOwnProperty("awayExitTimeout")) timeouts.exit.away = _config.awayExitTimeout;
   if (_config.hasOwnProperty("nightExitTimeout")) timeouts.exit.night = _config.nightExitTimeout;

   if (_config.hasOwnProperty("stayEntryTimeout")) timeouts.entry.stay = _config.stayEntryTimeout;
   if (_config.hasOwnProperty("awayEntryTimeout")) timeouts.entry.away = _config.awayEntryTimeout;
   if (_config.hasOwnProperty("nightEntryTimeout")) timeouts.entry.night = _config.nightEntryTimeout;

   if (_config.hasOwnProperty("stayTriggeredTimeout")) timeouts.triggered.stay = _config.stayTriggeredTimeout;
   if (_config.hasOwnProperty("awayTriggeredTimeout")) timeouts.triggered.away = _config.awayTriggeredTimeout;
   if (_config.hasOwnProperty("nightTriggeredTimeout")) timeouts.triggered.night = _config.nightTriggeredTimeout;

   // Timeouts
   this.ensurePropertyExists("stay-exit-timeout", "property", { initialValue: timeouts.exit.stay }, _config);
   this.ensurePropertyExists("stay-entry-timeout", "property", { initialValue: timeouts.entry.stay }, _config);
   this.ensurePropertyExists("stay-triggered-timeout", "property", { initialValue: timeouts.triggered.stay }, _config);
   this.ensurePropertyExists("away-exit-timeout", "property", { initialValue: timeouts.exit.away }, _config);
   this.ensurePropertyExists("away-entry-timeout", "property", { initialValue: timeouts.entry.away }, _config);
   this.ensurePropertyExists("away-triggered-timeout", "property", { initialValue: timeouts.triggered.away }, _config);
   this.ensurePropertyExists("night-exit-timeout", "property", { initialValue: timeouts.exit.night }, _config);
   this.ensurePropertyExists("night-entry-timeout", "property", { initialValue: timeouts.entry.night }, _config);
   this.ensurePropertyExists("night-triggered-timeout", "property", { initialValue: timeouts.triggered.night }, _config);

   // Internal - current timeouts based on arm state selected
   this.ensurePropertyExists("exit-timeout", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("entry-timeout", "property", { initialValue: 0 }, _config);
   this.ensurePropertyExists("triggered-timeout", "property", { initialValue: 120 }, _config);
   this.ensurePropertyExists("last-active-zone", "property", { initialValue: "" }, _config);

   this.ensurePropertyExists("target-state", "property", { initialValue: STATE_DISARMED }, _config);
   this.ensurePropertyExists("target-arm-state", "property", { initialValue: "disarmed" }, _config);
   this.ensurePropertyExists("current-state", "property", { initialValue: STATE_DISARMED }, _config);

   // Alarm status properties
   this.ensurePropertyExists("fire-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("medical-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("panic-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("duress-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("attack-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("carbon-monoxide-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("tamper-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("armed-normal", "property", { initialValue: false, source: { property: "alarm-state", transform: "$value === \"away-armed\"" }}, _config);
   this.ensurePropertyExists("part-armed", "property", { initialValue: false, source: { property: "alarm-state", transform: "($value === \"stay-armed\") || ($value === \"night-armed\")" }}, _config);
   this.ensurePropertyExists("stay-armed", "property", { initialValue: false, source: { property: "alarm-state", transform: "$value === \"stay-armed\"" }}, _config);
   this.ensurePropertyExists("night-armed", "property", { initialValue: false, source: { property: "alarm-state", transform: "$value === \"night-armed\"" }}, _config);
   this.ensurePropertyExists("away-armed", "property", { initialValue: false, source: { property: "alarm-state", transform: "$value === \"away-armed\"" }}, _config);
   this.ensurePropertyExists("in-exit-entry", "property", { initialValue: false, source: { property: "arm-state", transform: "($value === \"entry\") || ($value === \"exit\")" }}, _config);
   this.ensurePropertyExists("zone-alarm", "property", { initialValue: false, source: { property: "arm-state", transform: "$value === \"triggered\"" }}, _config);

   // Should be set by specific implementation
   this.ensurePropertyExists("confirmed-alarm", "property", { initialValue: false }, _config);
   this.ensurePropertyExists("alarm-error", "property", { initialValue: "" }, _config);
   this.ensurePropertyExists("entry-zone-active", "property", { initialValue: "" }, _config);
   this.ensurePropertyExists("guard-zone-active", "property", { initialValue: "" }, _config);

   // Core state machines
   this.ensurePropertyExists("arm-type-state", "stateproperty", { name: "arm-type-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "idle",
                                                                  states: [{ name: "idle",
                                                                             sources: [{ property: "target-state", value: STATE_STAY_ARM, nextState: "pre-stay" },
                                                                                       { property: "target-state", value: STATE_AWAY_ARM, nextState: "pre-away" },
                                                                                       { property: "target-state", value: STATE_NIGHT_ARM, nextState: "pre-night" },
                                                                                       { property: "tamper-alarm", value: true, nextState: "tamper" },
                                                                                       { property: "panic-alarm", value: true, nextState: "panic" } ]},
                                                                           { name: "tamper",
                                                                             sources: [{ property: "tamper-alarm", value: false, nextState: "idle" }]},
                                                                           { name: "panic",
                                                                             sources: [{ property: "panic-alarm", value: false, nextState: "idle" }]},
                                                                           { name: "pre-stay",
                                                                             actions: [{ property: "exit-timeout", fromProperty: "stay-exit-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "stay-triggered-timeout" },
                                                                                       { property: "entry-timeout", fromProperty: "stay-entry-timeout" }],
                                                                             timeout: [{ duration: 0.1, nextState: "stay" }]},
                                                                           { name: "pre-away",
                                                                             actions: [{ property: "exit-timeout", fromProperty: "away-exit-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "away-triggered-timeout" },
                                                                                       { property: "entry-timeout", fromProperty: "away-entry-timeout" }],
                                                                             timeout: { duration: 0.1, nextState: "away" }},
                                                                           { name: "pre-night",
                                                                             actions: [{ property: "exit-timeout", fromProperty: "night-exit-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "night-triggered-timeout" },
                                                                                       { property: "entry-timeout", fromProperty: "night-entry-timeout" }],
                                                                             timeout: { duration: 0.1, nextState: "night" }},
                                                                           { name: "stay",
                                                                             sources: [{ property: "alarm-state", value: "stay-disarmed", nextState: "idle" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] },
                                                                           { name: "away",
                                                                             sources: [{ property: "alarm-state", value: "away-disarmed", nextState: "idle" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] },
                                                                           { name: "night",
                                                                             sources: [{ property: "alarm-state", value: "night-disarmed", nextState: "idle" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] }] }, _config);

   this.ensurePropertyExists("arm-state", "stateproperty", { name: "arm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "disarmed",
                                                             states: [{ name: "disarmed",
                                                                        sources: [{ property: "target-arm-state", value: "armed", nextState: "exit" }],
                                                                        actions: [{ property: "retry-count", value: 0 },
                                                                                  { property: "current-state", value: STATE_DISARMED }]},
                                                                      { name: "exit",
                                                                        sources: [{ property: "target-state", value: STATE_DISARMED, nextState: "reset-to-disarmed" }],
                                                                        timeout: { property: "exit-timeout", nextState: "armed" }},
                                                                      { name: "armed",
                                                                        sources: [{ property: "target-state", value: STATE_DISARMED, nextState: "reset-to-disarmed" },
                                                                                  { event: "zone-entered", nextState: "entry" },
                                                                                  { event: "zone-triggered", nextState: "triggered" }]},
                                                                      { name: "entry",
                                                                        sources: [{ property: "target-state", value: STATE_DISARMED, nextState: "disarmed" },
                                                                                  { event: "zone-triggered", nextState: "triggered" }],
                                                                        timeout: { property: "entry-timeout", nextState: "triggered" }},
                                                                      { name: "triggered",
                                                                        sources: [{ property: "target-state", value: STATE_DISARMED, nextState: "reset-to-disarmed" }],
                                                                        actions: [{ property: "retry-count", apply: "++$value" },
                                                                                  { property: "current-state", value: STATE_ALARM_TRIGGERED }],
                                                                        timeout: { property: "triggered-timeout", nextState: "triggered-timed-out" }},
                                                                      { name: "reset-to-disarmed",
                                                                        sources: [{ property: "target-arm-state", value: "disarmed", nextState: "disarmed" }],
                                                                        actions: [{ property: "target-arm-state", value: "disarmed" }]},
                                                                      { name: "triggered-timed-out",
                                                                        sources: [{ property: "retry-allowed", value: true, nextState: "armed" },
                                                                                  { property: "retry-allowed", value: false, action: { property: "target-state", value: STATE_DISARMED }, nextState: "reset-to-disarmed" }] }]}, _config);

   this.ensurePropertyExists("alarm-state", "combinestateproperty", { name: "alarm-state", type: "combinestateproperty", ignoreControl: true,
                                                                      takeControlOnTransition: true, separator: "-",
                                                                      sources: [{ property: "arm-type-state" }, { property: "arm-state" }],
                                                                      states: [{ name: "stay-armed", actions: [{ property: "current-state", value: STATE_STAY_ARM }] },
                                                                               { name: "away-armed", actions: [{ property: "current-state", value: STATE_AWAY_ARM }] },
                                                                               { name: "night-armed", actions: [{ property: "current-state", value: STATE_NIGHT_ARM }] }] }, _config);

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
