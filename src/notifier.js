var util = require('util');
var Thing = require('./thing');

// Configuration
// title - Title of notification
// text - Text of notification
// responseTimeout - maximum time the notification should remain
// responses - undefined assumes no response required.
//   - Either property based [ { label: "a:" property: "a-prop", initialValue: false, responseValue: true, default: true } ] for multiple choice.
//   - Or event based [ { label: "a:" event: "an-event", default: true } ] for multiple choice.

// Resulting properties
// notifer-state - Notifier state { "idle", "notifying", "responded", "timed-out" }
// <response-properties> - user's response - valid when notifier-state is "responded"

function Notifier(_config, _parent) {
   Thing.call(this, _config, _parent);

   var responseServiceName = _config.hasOwnProperty("responseServiceName") ? _config.responseServiceName : this.gang.casa.findServiceName("whrelayservice");
   var responseService =  this.casa.findService(responseServiceName);

   if (!responseService) {
      console.error(this.uName + ": ***** Response service not found! *************");
      process.exit(3)
   }

   var responseServicePropertyType = _config.hasOwnProperty("responseServicePropertyType") ? _config.responseServicePropertyType : "whrelayproperty";
   var responseServiceEventType = _config.hasOwnProperty("responseServiceEventType") ? _config.responseServiceEventType : "whrelayevent";

   var serviceConfig = _config.serviceConfig;
   serviceConfig.id = this.uName.replace("::", "").replace(/:/g, "-");
   serviceConfig.serviceArgs.notifierUName = this.uName;
   serviceConfig.serviceArgs.user = _config.user.uName;
   serviceConfig.serviceArgs.responseServiceName = responseServiceName;
   serviceConfig.serviceArgs.title = _config.title;
   serviceConfig.serviceArgs.text = _config.text;

   this.responseTimeout = _config.hasOwnProperty("responseTimeout") ? _config.responseTimeout : _config.hasOwnProperty("responses") ? 60 : 1;
   serviceConfig.serviceArgs.responseTimeout = this.responseTimeout;

   this.responses =  util.copy(_config.responses, true);
   serviceConfig.serviceArgs.responses = this.responses;

   var respondSources = [];

   if (this.responses) {

      for (var j = 0; j < this.responses.length; ++j) {

         if (this.responses[j].hasOwnProperty("property")) {
            respondSources.push({ property: this.responses[j].property, value: this.responses[j].responseValue, nextState: "responded" });

            this.ensurePropertyExists(this.responses[j].property, responseServicePropertyType,
                                      { serviceName: responseServiceName, initialValue: this.responses[j].initialValue,
                                        source: { property: "notifier-state", value: "idle", transformMap: { "idle": this.responses[j].initialValue }}}, _config);
         }
         else if (this.responses[j].hasOwnProperty("event")) {
            respondSources.push({ event: this.responses[j].event, nextState: "responded" });
            this.ensureEventExists(this.responses[j].event, responseServiceEventType, { serviceName: responseServiceName }, _config);
         }
      }
   }

   this.ensurePropertyExists("notifier-state", 'stateproperty', 
                             { type: "stateproperty", initialValue: "idle", "ignoreControl": true, "takeControlOnTransition": true,
                               states: [{ name: "idle", sources: [{ event: "notify-"+this.name,  nextState: "notifying" }],
                                                        actions: [{ property: "responded", value: false }]},
                                        { name: "notifying", timeout: { duration: this.responseTimeout, nextState: "timed-out" },
                                                             sources: respondSources },
                                        { name: "responded", timeout: { duration: 1, nextState: "idle" }},
                                        { name: "timed-out", timeout: { duration: 1, nextState: "idle" }} ]}, _config);

   this.ensurePropertyExists("service-notifier-state", 'serviceproperty', this._formConfig(serviceConfig, { source: { "property": "notifier-state" }}, "write"), _config);
}

util.inherits(Notifier, Thing);

// Called when current state required
Notifier.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Notifier.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Notifier.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

Notifier.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

Notifier.prototype._formConfig = function(_baseConfig, _newConfig, _sync) {
   var config = util.copy(_baseConfig, true);
   util.assign(config, _newConfig);
   config.sync = _sync;
   return config;
};

module.exports = exports = Notifier;
