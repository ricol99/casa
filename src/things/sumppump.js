var util = require('util');
var Thing = require('../thing');

// Config
// levels - object of levels for sump-level-state { empty, low, mid, near-high, high, full }
// *pumpTimeout - how many seconds the pump is allowed to active for (default 60)
//   or pumpTimeouts - object of timeouts for sump-level-state { empty, low, mid, near-high, high, full } (default 60 for all)
// *maxRetries - number of retries before entering failure (default 2)
// *retryTimeout - How many secondss to wait until retry occurs (default 10)

// Properties to define
// level - actual sump level

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
// pump-timed-out - pump was active for too long (retry counter used to determine whether to go into failure mode). Retry timeout governs how long to stay in this state before retrying
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
      var value = (_config.hasOwnProperty('pumpTimeout')) ? _config.pumpTimeout : 60;
      this.pumpTimeouts = { "empty": value, "low": value, "mid": value, "near-high": value, "high": value, "full": value };
   }

   this.ensurePropertyExists('max-retries', 'property', { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists('retry-count', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('retry-allowed', 'compareproperty', { initialValue: true, sources: [{ property: "retry-count" }, { property: "max-retries" }], comparison: "$values[0] < $values[1]" }, _config);
   this.ensurePropertyExists('retry-timeout', 'property', { initialValue: _config.hasOwnProperty("retryTimeout") ? _config.retryTimeout : 10 }, _config);
   this.ensurePropertyExists('pump-timeout', 'property', { initialValue: this.pumpTimeouts.low }, _config);
   this.ensurePropertyExists('sump-level', 'quantiseproperty', { quanta: _config.levels, source: { property: "level"} }, _config);

   this.ensurePropertyExists('sump-level-state', 'stateproperty', { name: "sump-level-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "sump-empty",
                                                                    source: { property: "sump-level", transform: "\"sump-\" + $value" },
                                                                    states: [{ name: "sump-empty", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["empty"] }]},
                                                                             { name: "sump-low", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["low"] }]},
                                                                             { name: "sump-mid", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["mid"] }]},
                                                                             { name: "sump-near-high", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["near-high"] }]},
                                                                             { name: "sump-high", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["high"] }]},
                                                                             { name: "sump-full", actions: [{ property: "pump-timeout", value: this.pumpTimeouts["full"] }]} ] }, _config);

   this.ensurePropertyExists('pump-state', 'stateproperty', { name: "pump-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "pump-idle", 
                                                                       states: [{ name: "pump-idle", actions: [{ property: "retry-count", value: 0 }] },
                                                                                { name: "pump-active", actions: [{ property: "retry-count", apply: "++$value" }],
                                                                                  timeout: { source: { property: "pump-timeout" }, nextState: "pump-timed-out" }},
                                                                                { name: "pump-timed-out", 
                                                                                  sources: [{ property: "retry-allowed", value: false, nextState: "pump-failure" }],
                                                                                  timeout: { property: "retry-timeout", nextState: "pump-active" }}, 
                                                                                { name: "pump-failure", sources: [{ event: "pump-reset", nextState: "pump-idle" }]} ]}, _config);

   this.ensurePropertyExists('sump-pump-state', 'combinestateproperty', { name: "sump-pump-state", type: "combinestateproperty", ignoreControl: true, takeControlOnTransition: true, separator: "-", initialValue: "sump-empty-pump-idle",
                                                                          sources: [{ property: "sump-level-state" }, { property: "pump-state" }],
                                                                          states: [{ name: "sump-empty-pump-active", actions: [{ property: "pump-state", value: "pump-idle" }] },
                                                                                   { name: "sump-high-pump-idle", actions: [{ property: "pump-state", value: "pump-active" }] },
                                                                                   { name: "sump-full-pump-active", actions: [{ property: "pump-state", value: "pump-failure" }] },
                                                                                   { name: "sump-full-pump-idle", actions: [{ property: "pump-state", value: "pump-failure" }] }]}, _config);
}

util.inherits(SumpPump, Thing);

module.exports = exports = SumpPump;
