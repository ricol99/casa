var util = require('util');
var Thing = require('../thing');

// Config
// pumpTimeout - how many seconds the pump is allowed to active for
// or pumpTimeouts - object of timeouts for sump-level-state { low, mid, near-high, high, full }
// currentLevel - actual sump level
// levels - object of levels for sump-level-state { empty, low, mid, near-high, high, full }

// Resulting sump-level-state
// empty - sump empty (failure mode)
// low - at specified low-point
// mid - at specified mid-point
// near-high - just below specified high-point
// high - at specified high-point
// full - sump full (failure mode)

// Resulting pump-state
// pump-idle - pump is idle in working order
// pump-active - pump is active in working order
// pump-failure - pump has an issue (failure mode)

// Resulting sump-pump-state
// sump-<level>-pump-idle - pump is idle and is in working order at a specific sump level
// sump-<level>-pump-active - pump is active and is in working order at a specific sump level
// sump-<level>-pump-failure - pump has an issue - usually only when sump is full (failure mode)

function SumpPump(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "sumppump";

   if (_config.hasOwnProperty('pumpTimeouts')) {
      this.pumpTimeouts = _config.pumpTimeouts;
   }
   else {
      var value = (_config.hasOwnProperty('pumpTimeout')) ? _config.pumpTimeout : 600;
      this.pumpTimeouts = { "empty": value, "low": value, "mid": value, "near-high": value, "high": value, "full": value };
   }

   this.ensurePropertyExists('pump-timeout', 'property', { initialValue: this.pumpTimeouts.low }, _config);
   this.ensurePropertyExists('sump-level', 'quantiseproperty', { quanta: _config.levels }, _config);

   var sumpLevelStateConfig = { name: "sump-level-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", 
                                source: { property: "sump-level", transform: "\"sump-\" + $value" },
                                states: [{ name: "sump-empty", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["empty"] }]},
                                         { name: "sump-low", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["low"] }]},
                                         { name: "sump-mid", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["mid"] }]},
                                         { name: "sump-near-high", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["near-high"] }]},
                                         { name: "sump-high", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["high"] }]},
                                         { name: "sump-full", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["full"] }]} ] };

   this.ensurePropertyExists('sump-level-state', 'stateproperty', sumpLevelStateConfig, _config);

   this.ensurePropertyExists('pump-state', 'stateproperty', { name: "pump-state", type: "stateproperty", initialValue: "pump-idle", 
                                                                       states: [{ name: "pump-idle", },
                                                                                { name: "pump-active", timeout: { source: { property: "pump-timeout" }, nextState: "pump-failure" }},
                                                                                { name: "pump-failure", sources: [{ event: "pump-reset", nextState: "pump-idle" }]} ]}, _config);

   this.ensurePropertyExists('sump-pump-state', 'combinestateproperty', { name: "sump-pump-state", type: "combinestateproperty", separator: "-", initialValue: "sump-empty-pump-idle",
                                                                          sources: [{ property: "sump-level-state" }, { property: "pump-state" }] },
                                                                          states: [{ name: "sump-low-pump-active", actions: [{ property: "pump-state", value: "pump-idle" }] },
                                                                                   { name: "sump-high-pump-idle", actions: [{ property: "pump-state", value: "pump-active" }] },
                                                                                   { name: "sump-full-pump-active", actions: [{ property: "pump-state", value: "pump-failure" }] },
                                                                                   { name: "sump-full-pump-idle", actions: [{ property: "pump-state", value: "pump-failure" }] }] _config);
}

util.inherits(SumpPump, Thing);

module.exports = exports = SumpPump;
