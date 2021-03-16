var util = require('util');
var Thing = require('../thing');

// Config
// *operatingTimeout - how many seconds the access is allowed to active for (default 20)
//   or operatingTimeouts - object of timeouts for access { opening, closing } (default 20 for all)
// *maxRetries - number of retries before entering failure (default 2)
// *retryTimeout - How many secondss to wait until retry occurs (default 10)
// *responseTimeout - ow long are the access allowed to take before responding to a commmand (open or close) (defualt 5)

// Properties to define
// fully-closed - true when access is fully raised
// fully-open - true when access is fully in the ground
// safety-triggered - true when a safety system has halted everything

// Property to set
// target - "open" or "closed" - set to make the access move based on this property

// Resulting target-state
// target-unknown - no outstanding request
// target-open-requested  - request to open access, waiting for access to confirm it has started to open (waiting for fully-closed to be false)
// target-opening - access has confirmed it is opening (fully-closed is now false)
// target-closed-requested - request to open access, waiting for access to confirm it has started to close (waiting for fully-open to be false)
// target-closing - access has confirmed it is closing (fully-open is now false)
// target-achieved - target was achieved within the timing required
// target-not-achieved - target was not achieved, see other states for why

// Resulting access-state
// access-unknown - Initialisation - no clue what the state of the access is, waiting for fully-closed or fully-open to be set
// access-closed - access fully closed (raised for bollard)
// access-opening - access moving from closed to open
// access-open - access fully open (recessed in the ground for bollard)
// access-closing - access moving from open to closed

// Resulting alarm-state
// normal - everything is operating normally
// safety-alert - one of the safety systems has been triggered - pause everything
// timed-out - operation did not complete with required time specified - will retry
// failure - mulitple operaing failures and retry count has expired - need help

// Resulting access-alarm-state
// access-<status>-<alarm> - e.g. "access-open-normal" or "access-failure-normal"

function Access(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "access";

   if (_config.hasOwnProperty('operatingTimeouts')) {
      this.operatingTimeouts = _config.operatingTimeouts;
   }
   else {
      var value = (_config.hasOwnProperty('operatingTimeout')) ? _config.operatingTimeout : 20;
      this.operatingTimeouts = { "opening": value, "closing": value };
   }

   this.ensurePropertyExists('target', 'property', { initialValue: "unknown" }, _config);
   this.ensurePropertyExists('auto-close', 'property', { initialValue: _config.hasOwnProperty("autoClose") ? _config.autoClose : false }, _config);
   this.ensurePropertyExists('pause-time', 'property', { initialValue: _config.hasOwnProperty("pauseTime") ? _config.pauseTime : 120 }, _config);
   this.ensurePropertyExists('response-timeout', 'property', { initialValue: _config.hasOwnProperty("responseTimeout") ? _config.responseTimeout : 5 }, _config);
   this.ensurePropertyExists('opening-timeout', 'property', { initialValue: this.operatingTimeouts.opening }, _config);
   this.ensurePropertyExists('closing-timeout', 'property', { initialValue: this.operatingTimeouts.closing }, _config);
   this.ensurePropertyExists('max-retries', 'property', { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists('retry-count', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('retry-timeout', 'property', { initialValue: _config.hasOwnProperty("retryTimeout") ? _config.retryTimeout : 10 }, _config);
   this.ensurePropertyExists('retry-allowed', 'compareproperty', { initialValue: true,
                                                                   sources: [{ property: "retry-count" }, { property: "max-retries" }], comparison: "$values[0] < $values[1]" }, _config);

   this.ensurePropertyExists('target-state', 'stateproperty', { name: "target-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "target-unknown",
                                                                states: [{ name: "target-unknown",
                                                                           sources: [{ property: "target", value: "open", nextState: "target-open-requested" },
                                                                                     { property: "target", value: "closed", nextState: "target-closed-requested" }] },
                                                                         { name: "target-open-requested",
                                                                           sources: [{ property: "access-state", value: "access-opening", nextState: "target-opening" }],
                                                                           timeout: { property: "response-timeout", nextState: "target-not-achieved" }},
                                                                         { name: "target-opening",
                                                                           sources: [{ property: "access-state", value: "access-open", nextState: "target-achieved" }],
                                                                           timeout: { property: "opening-timeout", nextState: "target-not-achieved" }},
                                                                         { name: "target-closed-requested",
                                                                           sources: [{ property: "access-state", value: "access-closing", nextState: "target-closing" }],
                                                                           timeout: { property: "response-timeout", nextState: "target-not-achieved" }},
                                                                         { name: "target-closing",
                                                                           sources: [{ property: "access-state", value: "access-closed", nextState: "target-achieved" }],
                                                                           timeout: { property: "opening-timeout", nextState: "target-not-achieved" }},
                                                                         { name: "target-achieved", actions: [ { property: "target", value: "unknown"}, { event: "target-achieved" }],
                                                                           timeout: { duration: 0.5 , nextState: "target-unknown" }},
                                                                         { name: "target-not-achieved", actions: [ { property: "target", value: "unknown" }, { event: "target-not-achieved" }],
                                                                           timeout: { duration: 0.5 , nextState: "target-unknown" }} ]}, _config);

   this.ensurePropertyExists('access-state', 'stateproperty', { name: "access-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "access-unknown", 
                                                                 states: [{ name: "access-unknown",
                                                                            sources: [{ property: "fully-closed", value: true, nextState: "access-closed"},
                                                                                      { property: "fully-open", value: true, nextState: "access-open"}]},
                                                                          { name: "access-closed", actions: [{ property: "retry-count", value: 0 }],
                                                                            sources: [{ property: "fully-closed", value: false, nextState: "access-opening" }] },
                                                                          { name: "access-opening",
                                                                            sources: [{ property: "fully-open", value: true, nextState: "access-open" },
                                                                                      { property: "fully-closed", value: true, nextState: "access-closed" }] },
                                                                          { name: "access-open", actions: [{ property: "retry-count", value: 0 }],
                                                                            sources: [{ property: "fully-open", value: false, nextState: "access-closing" }] },
                                                                          { name: "access-closing",
                                                                            sources: [{ property: "fully-closed", value: true, nextState: "access-closed" },
                                                                                      { property: "fully-open", value: true, nextState: "access-open" }]} ]}, _config);

   this.ensurePropertyExists('alarm-state', 'stateproperty', { name: "alarm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "normal",
                                                               states: [{ name: "normal", sources: [{ property: "safety-triggered", value: true, nextState: "safety-triggered" }]},
                                                                        { name: "safety-alert", sources: [{ property: "safety-triggered", value: false, nextState: "normal" }]},
                                                                        { name: "timed-out",
                                                                          actions: [{ property: "retry-count", apply: "++$value" }],
                                                                          sources: [{ property: "safety-triggered", value: true, nextState: "safety-alert" },
                                                                                    { property: "retry-allowed", value: false, nextState: "failure" }],
                                                                          timeout: { property: "retry-timeout", nextState: "normal" }},
                                                                        { name: "failure", sources: [{ event: "access-reset", nextState: "normal" }]} ]}, _config);

   this.ensurePropertyExists('access-alarm-state', 'combinestateproperty', { name: "access-alarm-state", type: "combinestateproperty", ignoreControl: true,
                                                                              takeControlOnTransition: true, separator: "-", 
                                                                              sources: [{ property: "access-state" }, { property: "alarm-state" }],
                                                                              states: [{ name: "access-opening-normal",
                                                                                         timeout: { property: "opening-timeout", nextState: "access-opening-timed-out" } },
                                                                                       { name: "access-closing-normal",
                                                                                         timeout: { property: "closing-timeout", nextState: "access-closing-timeout" } },
                                                                                       { name: "access-opening-timed-out", actions: [{ property: "alarm-state", value: "timed-out"}] },
                                                                                       { name: "access-closing-timed-out", actions: [{ property: "alarm-state", value: "timed-out"}] }] }, _config);

   this.ensurePropertyExists('auto-close-state', 'stateproperty', { name: 'auto-close-state', initialValue: "not-active",  ignoreControl: true, takeControlOnTransition: true,
                                                                    states: [{ name: "not-active",
                                                                               sources: [{ guard: { "active": true, "property": "auto-close" },
                                                                                           property: "access-alarm-state", value: "access-open-normal", nextState: "primed" }] },
                                                                             { name: "primed", timeout: { property: "pause-time", nextState: "active" },
                                                                               sources: [{ property: "access-state", value: "access-closing", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-closed", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-opening", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "safey-alert", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "timed-out", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "failure", nextState: "not-active" }]},
                                                                             { name: "active", actions: [{ property: "target", value: "closed" }], 
                                                                               timeout: { duration: 2, nextState: "not-active" }} ]}, _config);
}

util.inherits(Access, Thing);

module.exports = exports = Access;
