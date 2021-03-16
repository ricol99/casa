var util = require('util');
var Thing = require('../thing');

// Config
// levels - object of levels for sump-level-state { empty, low, mid, high, full }
// *pumpTimeout - how many seconds the pump is allowed to active for (default 60)
//   or pumpTimeouts - object of timeouts for sump-level-state { empty, low, mid, high, full } (default 60 for all)
// *maxRetries - number of retries before entering failure (default 2)
// *retryTimeout - How many secondss to wait until retry occurs (default 10)

// Properties to define
// fully-closed - true when bollard is fully raised
// fully-open - true when bollard is fully in the ground
// target-state - "open" or "closed"
// safety-triggered - true when a safety system has halted everything

// Resulting bollard-state
// bollard-unknown - Initialisation - no clue where the bollard current is, waiting for  fully-closed or fully-open to be set
// bollard-closed - bollard fully raised
// bollard-opening - bollard moving from closed to open
// bollard-open - bollard fully recessed in the ground
// bollard-closing - bollard moving from open to closed

// Resulting alarm-state
// normal - everything is operating normally
// safety-alert - one of the safety systems has been triggered - pause everything
// timed-out - operation did not complete with required time specified - will retry
// failure - mulitple operaing failures and retry count has expired - need help

// Resulting bollard-alarm-state
// bollard-<status>-<alarm> - e.g. "bollard-open-normal" or "bollard-failure-normal"

function Bollard(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "bollard";

   if (_config.hasOwnProperty('operatingTimeouts')) {
      this.operatingTimeouts = _config.operatingTimeouts;
   }
   else {
      var value = (_config.hasOwnProperty('operatingTimeout')) ? _config.operatingTimeout : 20;
      this.operatingTimeouts = { "opening": value, "closing": value };
   }

   this.ensurePropertyExists('pause-time', 'property', { initialValue: _config.hasOwnProperty("pauseTime") ? _config.pauseTime : 120 }, _config);
   this.ensurePropertyExists('opening-timeout', 'property', { initialValue: this.operatingTimeouts.opening }, _config);
   this.ensurePropertyExists('closing-timeout', 'property', { initialValue: this.operatingTimeouts.closing }, _config);
   this.ensurePropertyExists('max-retries', 'property', { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists('retry-count', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('retry-timeout', 'property', { initialValue: _config.hasOwnProperty("retryTimeout") ? _config.retryTimeout : 10 }, _config);
   this.ensurePropertyExists('retry-allowed', 'compareproperty', { initialValue: true,
                                                                   sources: [{ property: "retry-count" }, { property: "max-retries" }], comparison: "$values[0] < $values[1]" }, _config);


   this.ensurePropertyExists('bollard-state', 'stateproperty', { name: "bollard-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "bollard-unknown", 
                                                                 states: [{ name: "bollard-unknown",
                                                                            sources: [{ property: "fully-closed", nextState: "bollard-closed"} { property: "fully-open", nextState: "bollard-open"}]},
                                                                          { name: "bollard-closed", actions: [{ property: "retry-count", value: 0 }],
                                                                            sources: [{ property: "target-state", value: "open", nextState: "bollard-opening" }] },
                                                                          { name: "bollard-opening",
                                                                            sources: [{ property: "fully-open", nextState: "bollard-open" }] },
                                                                          { name: "bollard-open", actions: [{ property: "retry-count", value: 0 }],
                                                                            sources: [{ property: "target-state", value: "closed", nextState: "bollard-closing" }] },
                                                                          { name: "bollard-closing",
                                                                            sources: [{ property: "fully-closed", nextState: "bollard-closed" }]} ]}, _config);

   this.ensurePropertyExists('alarm-state', 'stateproperty', { name: "alarm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "normal",
                                                               states: [{ name: "normal", sources: [{ property: "safety-triggered", nextState: "safety-triggered" }]},
                                                                        { name: "safety-alert", sources: [{ property: "safety-triggered", value: false, nextState: "normal" }]},
                                                                        { name: "timed-out",
                                                                          actions: [{ property: "retry-count", apply: "++$value" }],
                                                                          sources: [{ property: "safety-triggered", nextState: "safety-alert" },
                                                                                    { property: "retry-allowed", value: false, nextState: "failure" }],
                                                                          timeout: { property: retry-timeout, nextState: "normal" }},
                                                                        { name: "failure", sources: [{ event: "bollard-reset", nextState: "normal" }]} ]}, _config);

   this.ensurePropertyExists('bollard-alarm-state', 'combinestateproperty', { name: "bollard-alarm-state", type: "combinestateproperty", ignoreControl: true,
                                                                              takeControlOnTransition: true, separator: "-", initialValue: "bollard-unknown-normal",
                                                                              sources: [{ property: "bollard-state" }, { property: "alarm-state" }],
                                                                              states: [{ name: "bollard-opening-normal",
                                                                                         timeout: [{ property: "opening-timeout", nextState: "bollard-opening-timed-out" }] },
                                                                                       { name: "bollard-closing-normal",
                                                                                         timeout: [{ property: "closing-timeout", nextState: "bollard-closing-timeout" }] },
                                                                                       { name: "bollard-opening-timed-out", actions: [{ property: "alarm-state", value: "timed-out"}] },
                                                                                       { name: "bollard-closing-timed-out", actions: [{ property: "alarm-state", value: "timed-out"}] }] }, _config);

   if (_config.hasOwnProperty("auto-close") && _config.autoClose) {
      this.ensurePropertyExists('auto-close', 'stateproperty', { name: 'auto-close', initialValue: "not-active",  ignoreControl: true, takeControlOnTransition: true,
                                                                 states: [{ name: "not-active", sources: [{ property: "bollard-alarm-state", value: "bollard-open-normal", nextState: "primed"}] },
                                                                          { name: "primed", timeout: { property: "pause-time", nextState: "active" },
                                                                            sources: [{ property: "bollard-state", value: "bollard-closing", nextState: "not-active" },
                                                                                      { property: "bollard-state", value: "bollard-closed", nextState: "not-active" }
                                                                                      { property: "bollard-state", value: "bollard-opening", nextState: "not-active" },
                                                                                      { property: "alarm-state", value: "safey-alert", nextState: "not-active" },
                                                                                      { property: "alarm-state", value: "timed-out", nextState: "not-active" },
                                                                                      { property: "alarm-state", value: "failure", nextState: "not-active" }]},
                                                                          { name: "active", actions: [{ property: "target-state", value: "closed" }], 
                                                                            timeout: { duration: 1, nextState: "not-active" }} ]}, _config);
   }
}

util.inherits(Bollard, Thing);

module.exports = exports = Bollard;
