var util = require('util');
var Thing = require('../thing');

// Config properties to define
// opening-timeout - how many seconds the access is allowed to active for when opening (default 20)
// closing-timeout - how many seconds the access is allowed to active for when closing (default 20)
// auto-close - auto close after pause-time
// pause-time - duration (seconds) of pause when fully open to initiate auto-close
// max-retries - number of retries before entering failure (default 2)
// retry-timeout - How many secondss to wait until retry occurs (default 10)
// response-timeout - ow long are the access allowed to take before responding to a commmand (open or close) (default 5)
// start-pulse-length - how long is start pulse for open and close (seconds) (default 1)
// movement-timeout - timeout for using safety sensors as movement sensors - in seconds - default 5

// Config 
// simulateFullyOpen - used where bollards cannot indicate they are fully open

// Config properties to define if simulating fully open
// simulated-opening-time - on required when simulating fully-open - time taken for bollards to open in seconds (default 10)
// simulated-opening-response-time - duration after open command for which the simulated open should respond (default 0.5)
// simulated-security-alert-response-time - duration after security alert during closing before open is reinitiated (default 1)

// Events to control access
// access-reset - clear a failure condition
// open-access - command access to open access(does nothing if already open)
// close-access - command access to close access (does nothing if already closed)

// Property to set for operation
// target - "open" or "closed" - set to make the access move based on this property

// Output properties to define
// fully-closed - true when access is fully raised
// fully-open - true when access is fully in the ground (not required if simulateFullyOpen is true)
// safety-alert - true when a safety system has halted everything
// movement-when-closed - true when safety systems detect any movement when the access is closed

// Resulting access-state
// access-unknown - Initialisation - no clue what the state of the access is, waiting for fully-closed or fully-open to be set
// access-open-requested - access has been asked to open, response-timer started and waiting for access to respond (waiting for fully-closed to go false)
// access-opening - access moving from closed to open
// access-returned-to-close - access was opening but sensors have recognised that the access has returned to closed (manual intervention)
// access-open - access fully open (recessed in the ground for bollard)
// access-closed-requested - access has been asked to closed, response-timer started and waiting for access to respond (waiting for fully-open to go false)
// access-closing - access moving from open to closed
// access-returned-to-open - access was closing but sensors have recognised that the access has returned to open (manual intervention)
// access-closed - access fully closed (raised for bollard)

// Resulting alarm-state
// normal - everything is operating normally
// safety-alert - one of the safety systems has been triggered - pause everything
// timed-out - operation did not complete with required time specified - will retry
// failure - mulitple operaing failures and retry count has expired - need help

// Resulting access-alarm-state
// access-<status>-<alarm> - e.g. "access-open-normal" or "access-failure-normal"

// Resulting pulse to open or close
// start - true for <start-pulse-length> when open or shut is ordered
// open - true for <start-pulse-length> when open is ordered
// close - true for duration of close manoeuvre when closure is ordered

function Access(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "access";

   // Config properties
   this.ensurePropertyExists('opening-timeout', 'property', { initialValue: 20 }, _config);
   this.ensurePropertyExists('closing-timeout', 'property', { initialValue: 20 }, _config);
   this.ensurePropertyExists('auto-close', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('pause-time', 'property', { initialValue: 120 }, _config);
   this.ensurePropertyExists('max-retries', 'property', { initialValue: 2 }, _config);
   this.ensurePropertyExists('retry-timeout', 'property', { initialValue: 10 }, _config);
   this.ensurePropertyExists('response-timeout', 'property', { initialValue: 5 }, _config);
   this.ensurePropertyExists('start-pulse-length', 'property', { initialValue: 1 }, _config);
   this.ensurePropertyExists('movement-timeout', 'property', { initialValue: 5 }, _config);

   if (_config.simulateFullyOpen) {
      this.ensurePropertyExists('fully-open', 'property', { initialValue: false }, _config);
      this.ensurePropertyExists('simulated-opening-time', 'property', { initialValue: 10 }, _config);
      this.ensurePropertyExists('previous-simulated-opening-time', 'property', { initialValue: this.getProperty("simulated-opening-time"), source: { property: "simulated-opening-time" }}, _config);
      this.ensurePropertyExists('simulated-opening-response-time', 'property', { initialValue: 0.5 }, _config);
      this.ensurePropertyExists('simulated-security-alert-response-time', 'property', { initialValue: 1 }, _config);
      this.ensurePropertyExists('simulated-closing-timeout', 'property', { initialValue: this.getProperty("closing-timeout")-0.1, source: { property: "closing-timeout", transform: "$value-0.1" }}, _config);
      this.ensurePropertyExists('adjusted-simulated-opening-time', 'evalproperty', { local: true, initialValue: 0,
                                                                                     sources: [{ property: "previous-simulated-opening-time" }, { property: "simulated-security-alert-response-time" }], expression: "$values[0] + $values[1]" }, _config);


      this.ensurePropertyExists('fully-open-state', 'stateproperty', { initialValue: "unknown", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true,
                                                                       states: [{ name: "unknown",
                                                                                  timeout: { "property": "simulated-opening-time", nextState: "fully-open" },
                                                                                  sources: [{ property: "fully-closed", value: true, nextState: "fully-closed" },
                                                                                            { property: "fully-open", value: true, nextState: "fully-open" } ]},
                                                                                { name: "fully-open",
                                                                                  actions: [{ property: "fully-open", value: true }, { property: "adjusted-simulated-opening-time", fromProperty: "simulated-opening-time" }],
                                                                                  sources: [{ property: "fully-closed", value: true, nextState: "fully-closed"},
                                                                                            { property: "access-alarm-state", value: "access-closed-requested-normal", nextState: "closed-requested" }] },
                                                                                { name: "fully-closed",
                                                                                  actions: [{ property: "fully-open", value: false }, { property: "adjusted-simulated-opening-time", fromProperty: "simulated-opening-time" }],
                                                                                  sources: [{ property: "fully-closed", value: false, nextState: "opening"}] },
                                                                                { name: "opening", 
                                                                                  timeout: { "property": "adjusted-simulated-opening-time", nextState: "fully-open" },
                                                                                  sources: [{ property: "fully-closed", value: true, nextState: "fully-closed"},
                                                                                            { property: "access-alarm-state", value: "access-closed-requested-normal", nextState: "closing" }] },
                                                                                { name: "closed-requested", 
                                                                                  timeout: { "property": "simulated-opening-response-time", nextState: "closing" },
                                                                                  sources: [{ property: "fully-closed", value: true, nextState: "fully-closed"},
                                                                                            { property: "access-alarm-state", value: "access-open-requested-normal", nextState: "opening" }] },
                                                                                { name: "closing", actions: [{ property: "fully-open", value: false }],
                                                                                  timeout: { "property": "simulated-closing-timeout", nextState: "fully-open" },
                                                                                  sources: [{ property: "fully-closed", value: true, nextState: "fully-closed"},
                                                                                            { property: "alarm-state", value: "timed-out", nextState: "closing" },
                                                                                            { property: "alarm-state", value: "failure",
                                                                                              action: { property: "adjusted-simulated-opening-time", fromProperty: "simulated-opening-time" }, nextState: "unknown" },
                                                                                            { property: "alarm-state", value: "safety-alert",
                                                                                              action: { property: "previous-simulated-opening-time", apply: "$stateDuration" }, nextState: "unknown" },
                                                                                            { property: "access-alarm-state", value: "access-open-requested-normal",
                                                                                              action: { property: "previous-simulated-opening-time", apply: "$stateDuration" }, nextState: "opening" }] } ]}, _config);
   }

   if (this.properties.hasOwnProperty("target")) {
      this.properties["target"].addNewSource({ uName: this.uName, event: "open-access", transform: "\"open\"" });
      this.properties["target"].addNewSource({ uName: this.uName, event: "close-access", transform: "\"closed\"" });
   }
   else {
      this.ensurePropertyExists('target', 'property', { initialValue: "unknown", sources: [{ event: "open-access", transform: "\"open\"" }, { event: "close-access", transform: "\"closed\"" }] }, _config);
   }

   this.ensurePropertyExists('start', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('open', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('close', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('retry-count', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('retry-allowed', 'evalproperty', { initialValue: true,
                                                                sources: [{ property: "retry-count" }, { property: "max-retries" }, { property: "alarm-state" }], expression: "($values[0] < $values[1]) && ($values[2] !== \"safety-alert\")" }, _config);

   this.ensurePropertyExists('movement-state', 'stateproperty', { initialValue: "no-movement", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true,
                                                                  states: [{ name: "no-movement", sources: [{ property: "safety-alert", value: true, nextState: "movement" }] },
                                                                           { name: "movement", timeout: { property: "movement-timeout", nextState: "no-movement" } } ]}, _config);

   this.ensurePropertyExists('movement-access-state', 'combinestateproperty', { separator: "-", sources: [{ property: "movement-state" }, { property: "access-state" }] }, _config);
   this.ensurePropertyExists('movement-when-closed', 'property', { sources: [{ property: "movement-access-state", transform: "$value === \"movement-access-closed\"" }] }, _config);

   this.ensurePropertyExists('access-state', 'stateproperty', { name: "access-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "access-unknown", 
                                                                states: [{ name: "access-unknown",
                                                                           sources: [{ property: "fully-closed", value: true, nextState: "access-setup-closed" },
                                                                                     { property: "fully-open", value: true, nextState: "access-setup-open" }]},
                                                                         { name: "access-setup-open",
                                                                           actions: [{ property: "target", value: "open" }],
                                                                           sources: [{ property: "target", value: "open", nextState: "access-open" }]},
                                                                         { name: "access-setup-closed",
                                                                           actions: [{ property: "target", value: "closed" }],
                                                                           sources: [{ property: "target", value: "closed", nextState: "access-closed" }]},
                                                                         { name: "access-open-requested", actions: [{ property: "close", value: false }],
                                                                           sources: [{ property: "fully-closed", value: false, nextState: "access-opening" }] },
                                                                         { name: "access-opening", actions: [{ property: "target", value: "open" }],
                                                                           sources: [{ property: "fully-open", value: true, nextState: "access-open" },
                                                                                     { property: "fully-closed", value: true, nextState: "access-returned-to-closed" }] },
                                                                         { name: "access-returned-to-open", actions: [{ property: "target", value: "open" }],
                                                                           sources: [{ property: "target", value: "open", nextState: "access-open"}] },
                                                                         { name: "access-open",
                                                                           actions: [{ property: "retry-count", value: 0 }, { property: "start", value: false },
                                                                                     { property: "open", value: false }, { property: "close", value: false }],
                                                                           sources: [{ property: "target", value: "closed", nextState: "access-closed-requested" },
                                                                                     { guard: { property: "fully-closed", value: false }, property: "fully-open", value: false, nextState: "access-closing" },
                                                                                     { property: "fully-closed", value: true, nextState: "access-returned-to-closed" }] },
                                                                         { name: "access-closed-requested",
                                                                           sources: [{ property: "fully-open", value: false, nextState: "access-closing" }] },
                                                                         { name: "access-closing", actions: [{ property: "target", value: "closed" }],
                                                                           sources: [{ property: "fully-closed", value: true, nextState: "access-closed" },
                                                                                     { property: "fully-open", value: true, nextState: "access-returned-to-open" }]},
                                                                         { name: "access-returned-to-closed", actions: [{ property: "target", value: "closed" }],
                                                                           sources: [{ property: "target", value: "closed", nextState: "access-closed"}] },
                                                                         { name: "access-closed",
                                                                           actions: [{ property: "retry-count", value: 0 }, { property: "start", value: false },
                                                                                     { property: "open", value: false }, { property: "close", value: false }],
                                                                           sources: [{ property: "target", value: "open", nextState: "access-open-requested" },
                                                                                     { property: "fully-closed", value: false, nextState: "access-opening" }] } ]}, _config);

   this.ensurePropertyExists('alarm-state', 'stateproperty', { name: "alarm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "normal",
                                                               states: [{ name: "normal", sources: [{ property: "safety-alert", value: true, nextState: "safety-alert" }]},
                                                                        { name: "safety-alert", sources: [{ property: "safety-alert", value: false, nextState: "normal" }]},
                                                                        { name: "timed-out",
                                                                          actions: [{ property: "retry-count", apply: "++$value" }],
                                                                          sources: [{ property: "safety-alert", value: true, nextState: "safety-alert" },
                                                                                    { property: "retry-allowed", value: false, nextState: "failure" }],
                                                                          timeout: { property: "retry-timeout", nextState: "normal" }},
                                                                        { name: "failure",
                                                                          sources: [{ event: "access-reset", nextState: "normal" }] }] }, _config);
                                                                          //timeout: { duration: 300, nextState: "normal" } }] }, _config);

   this.ensurePropertyExists('access-alarm-state', 'combinestateproperty', { name: "access-alarm-state", type: "combinestateproperty", ignoreControl: true,
                                                                              takeControlOnTransition: true, separator: "-", 
                                                                              sources: [{ property: "access-state" }, { property: "alarm-state" }],
                                                                              states: [ { name: "access-open-requested-normal",
                                                                                         timeout: { property: "response-timeout", nextState: "access-open-requested-timed-out" } },
                                                                                       { name: "access-opening-normal",
                                                                                         timeout: { property: "opening-timeout", nextState: "access-opening-timed-out" } },
                                                                                       { name: "access-closed-requested-normal",
                                                                                         timeout: { property: "response-timeout", nextState: "access-closed-requested-timed-out" } },
                                                                                       { name: "access-closing-normal",
                                                                                         timeout: { property: "closing-timeout", nextState: "access-closing-timed-out" } },
                                                                                       { name: "access-open-requested-timed-out",
                                                                                         actions: [{ property: "alarm-state", value: "timed-out"}] ,
                                                                                         sources: [{ property: "alarm-state", value: "safety-alert", nextState: "access-returned-to-closed-safety-alert"}] },
                                                                                       { name: "access-closed-requested-timed-out",
                                                                                         actions: [{ property: "alarm-state", value: "timed-out"}] },
                                                                                       { name: "access-open-failure",
                                                                                         actions: [ { property: "target", "value": "open" }] },
                                                                                       { name: "access-close-failure",
                                                                                         actions: [ { property: "target", "value": "close" }] },
                                                                                       { name: "access-open-requested-safety-alert",
                                                                                         timeout: { property: "response-timeout", nextState: "access-open-requested-timed-out" } },
                                                                                       { name: "access-opening-safety-alert",
                                                                                         timeout: { property: "opening-timeout", nextState: "access-opening-timed-out" } },
                                                                                       { name: "access-closing-safety-alert",
                                                                                         actions: [{ property: "fully-open-state", "value": "opening" }] },
                                                                                       { name: "access-closed-requested-safety-alert",
                                                                                         actions: [{ property: "target", "value": "open" },
                                                                                                   { property: "access-state", value: "access-open"}] },
                                                                                       { name: "access-open-requested-failure",
                                                                                         actions: [ { property: "target", "value": "closed" },
                                                                                                    { property: "access-state", value: "access-closed" }] },
                                                                                       { name: "access-closed-requested-failure",
                                                                                         actions: [{ property: "target", "value": "open" },
                                                                                                   { property: "access-state", value: "access-open"}] },
                                                                                       { name: "access-opening-timed-out",
                                                                                         actions: [{ property: "alarm-state", value: "timed-out"}] },
                                                                                       { name: "access-closing-timed-out",
                                                                                         actions: [{ property: "alarm-state", value: "timed-out"}] }] }, _config);

   this.ensurePropertyExists('auto-close-state', 'stateproperty', { name: 'auto-close-state', initialValue: "not-active",  ignoreControl: true, takeControlOnTransition: true,
                                                                    states: [{ name: "not-active",
                                                                               sources: [{ guard: { "active": true, "property": "auto-close" },
                                                                                           property: "access-alarm-state", value: "access-open-normal", nextState: "primed" }] },
                                                                             { name: "primed", timeout: { property: "pause-time", nextState: "active" },
                                                                               sources: [{ property: "access-state", value: "access-closed-requested", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-closing", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-closed", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-opening", nextState: "not-active" },
                                                                                         { property: "access-state", value: "access-open-requested", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "safey-alert", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "timed-out", nextState: "not-active" },
                                                                                         { property: "alarm-state", value: "failure", nextState: "not-active" }]},
                                                                             { name: "active", actions: [{ property: "target", value: "closed" }], 
                                                                               timeout: { duration: 2, nextState: "not-active" }} ]}, _config);

   this.ensurePropertyExists('start-pulse-state', 'stateproperty', { name: 'start-pulse-state', initialValue: "not-active",  ignoreControl: true, takeControlOnTransition: true,
                                                                     states: [{ name: "not-active",
                                                                                sources: [{ "property": "access-alarm-state", "value": "access-open-requested-normal", "nextState": "active-opening" },
                                                                                          { "property": "access-alarm-state", "value": "access-open-requested-safety-alert", "nextState": "active-opening" },
                                                                                          { "property": "access-alarm-state", "value": "access-closed-requested-normal", "nextState": "active-closing" }] },
                                                                              { name: "active-opening",
                                                                                actions: [{ "property": "start", "value": true }, { "property": "open", "value": true }],
                                                                                timeout: { "property": "start-pulse-length", "nextState": "await-open-action-finished" }},
                                                                              { name: "active-closing",
                                                                                actions: [{ "property": "start", "value": true }, { "property": "close", "value": true }],
                                                                                timeout: { "property": "start-pulse-length", "nextState": "await-close-action-finished" }},
                                                                              { name: "await-open-action-finished",
                                                                                actions: [{ "property": "start", "value": false }, { "property": "open", "value": false }],
                                                                                sources: [{ "property": "access-alarm-state", "value": "access-open-normal", "nextState": "not-active" },
                                                                                          { "property": "access-alarm-state", "value": "access-open-safety-alert", "nextState": "not-active" },
                                                                                          { "property": "access-alarm-state", "value": "access-closed-normal", "nextState": "not-active" },
                                                                                          { "property": "alarm-state", "value": "timed-out", "nextState": "not-active"},
                                                                                          { "property": "alarm-state", "value": "failure", "nextState": "not-active"},
                                                                                          { "property": "fully-open", "value": true, "nextState": "not-active" }]},
                                                                              { name: "await-close-action-finished",
                                                                                actions: [{ "property": "start", "value": false }],
                                                                                sources: [{ "property": "access-alarm-state", "value": "access-open-normal", "nextState": "not-active" },
                                                                                          { "property": "alarm-state", "value": "safety-alert", "nextState": "not-active" },
                                                                                          { "property": "alarm-state", "value": "timed-out", "nextState": "not-active"},
                                                                                          { "property": "alarm-state", "value": "failure", "nextState": "not-active"},
                                                                                          { "property": "access-alarm-state", "value": "access-closed-normal", "nextState": "not-active" },
                                                                                          { "property": "fully-closed", "value": true, "nextState": "not-active" }] }]}, _config);
}

util.inherits(Access, Thing);

// Called when current state required
Access.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Access.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Access.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

Access.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

module.exports = exports = Access;
