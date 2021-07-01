var util = require('util');
var Thing = require('../thing');

// Please define properties for automated functionality
// title - Title of notification
// text - Text of notification
// response-timeout - Maximum duration to wait before a response it received  

// Configuration
// user - uName to target notification at
// defaultResponse - Default response (N/A for responseType == "none")
// validResponses - undefined = free, [ "a", "b", "c" ] for multiple choice

// Resulting properties
// notifer-state - Notifier state { "idle", "notifying", "responded", "timed-out" }
// response - user's response - valid when state === "answered"

function Notifier(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.user = this.gang.findNamedObject(_config.user.uName);
   this.defaultResponse = _config.defaultResponse;
   this.validResponses = _config.validResponses;

   this.ensurePropertyExists("response-timeout", 'property', { "initialValue": 60 }, _config);
   this.ensurePropertyExists("response", 'property', { "initialValue": "_not-answered_" }, _config);

   this.ensurePropertyExists("notifier-state", 'stateproperty', 
                             { type: "stateproperty", initialValue: "idle", "ignoreControl": true, "takeControlOnTransition": true,
                               states: [{ name: "idle", sources: [{ event: "notify-"+this.name,  nextState: "notifying" }],
                                                        actions: [{ property: "responded", value: false }, { property: "response", value: "_not-answered_" }]},
                                        { name: "notifying", timeout: { property: "response-timeout", nextState: "timed-out",
                                                             sources: [{ property: "responded", value: "true", nextState: "responded" }]},
                                        { name: "responded", timeout: { duration: 1, nextState: "idle" }},
                                        { name: "timed-out", timeout: { duration: 1, nextState: "idle" }} ]}, _config);
}

util.inherits(Notifier, Thing);

module.exports = exports = Notifier;
