var util = require('util');
var Thing = require('./thing');

// Configuration
// title - Title of notification
// text - Text of notification
// responseTimeout - maximum time the notification should remain
// responses - undefined assumes no response required.  [ { label: "a:" property: "a-prop", value: true, default: true } ] for multiple choice.

// Resulting properties
// notifer-state - Notifier state { "idle", "notifying", "responded", "timed-out" }
// <response-properties> - user's response - valid when notifier-state is "responded"

function Notifier(_config, _parent) {
   Thing.call(this, _config, _parent);

   var smeeServiceName = _config.hasOwnProperty("smeeServiceName") ? _config.smeeServiceName : this.gang.casa.findServiceName("smeeservice");
   var smeeService =  this.casa.findService(smeeServiceName);

   if (!smeeService) {
      console.error(this.uName + ": ***** Smee service not found! *************");
      process.exit(3)
   }

   var serviceConfig = _config.serviceConfig;
   serviceConfig.id = this.uName.replace("::", "").replace(/:/g, "-");
   serviceConfig.serviceArgs.notifierUName = this.uName;
   serviceConfig.serviceArgs.smeeUrl = smeeService.getUrl();
   serviceConfig.serviceArgs.title = _config.title;
   serviceConfig.serviceArgs.text = _config.text;

   this.responseTimeout = _config.hasOwnProperty("responseTimeout") ? _config.responseTimeout : _config.hasOwnProperty("responses") ? 60 : 1;
   serviceConfig.serviceArgs.responseTimeout = this.responseTimeout;

   this.responses =  util.copy(_config.responses, true);
   serviceConfig.serviceArgs.responses = this.responses;

   var respondPropSources = [];

   if (this.responses) {

      for (var j = 0; j < this.responses.length; ++j) {
         respondPropSources.push({ property: this.responses[j].property, value: this.responses[j].value, nextState: "responded" });
         this.ensurePropertyExists(this.responses[j].property, "smeeproperty", { serviceName: smeeServiceName, source: { property: "notifier-state", value: "idle", transform: "false" }}, _config);
      }
   }

   this.ensurePropertyExists("notifier-state", 'stateproperty', 
                             { type: "stateproperty", initialValue: "idle", "ignoreControl": true, "takeControlOnTransition": true,
                               states: [{ name: "idle", sources: [{ event: "notify-"+this.name,  nextState: "notifying" }],
                                                        actions: [{ property: "responded", value: false }]},
                                        { name: "notifying", timeout: { duration: this.responseTimeout, nextState: "timed-out" },
                                                             sources: respondPropSources },
                                        { name: "responded", timeout: { duration: 1, nextState: "idle" }},
                                        { name: "timed-out", timeout: { duration: 1, nextState: "idle" }} ]}, _config);

   this.ensurePropertyExists("service-notifier-state", 'serviceproperty', this._formConfig(serviceConfig, { source: { "property": "notifier-state" }}, "write"), _config);
}

util.inherits(Notifier, Thing);

Notifier.prototype._formConfig = function(_baseConfig, _newConfig, _sync) {
   var config = util.copy(_baseConfig, true);
   util.assign(config, _newConfig);
   config.sync = _sync;
   return config;
};

module.exports = exports = Notifier;
