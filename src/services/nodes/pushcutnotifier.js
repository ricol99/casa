var util = require('util');
var ServiceNode = require('./servicenode');

function PushcutNotifier(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
}

util.inherits(PushcutNotifier, ServiceNode);

// Called when current state required
PushcutNotifier.prototype.export = function(_exportObj) {
   ServiceNode.prototype.export.call(this, _exportObj);
};

// Called when current state required
PushcutNotifier.prototype.import = function(_importObj) {
   ServiceNode.prototype.import.call(this, _importObj);
};

PushcutNotifier.prototype.coldStart = function() {
   ServiceNode.prototype.coldStart.call(this);
};

PushcutNotifier.prototype.hotStart = function() {
   ServiceNode.prototype.hotStart.call(this);
};

PushcutNotifier.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);

   if (!this.notifierUName) {
      this.notifierUName = _subscription.args.notifierUName;
      this.responseServiceName = _subscription.args.responseServiceName;
      this.user = _subscription.args.user;
      this.title = _subscription.args.title;
      this.text = _subscription.args.text;
      this.sound = _subscription.args.sound;
      this.image = _subscription.args.image;
      this.devices = _subscription.args.devices;
      this.responses = _subscription.args.responses;

      this.responseService =  this.casa.findService(this.responseServiceName);

      if (!this.responseService) {
         console.error(this.uName + ": ***** Response service not found! *************");
         process.exit(3)
      }

      this.responseService.addHttpInfoToResponses(this.notifierUName, this.responses);
   }
};

PushcutNotifier.prototype.processPropertyChanged = function(_transaction, _callback) {

   try {
      for (var prop in _transaction.properties) {

         if ((prop === "service-notifier-state") && (_transaction.properties[prop] === "notifying")) {
            var notification = { title: this.title, text: this.text };

            if (this.sound) { notification.sound = this.sound; }
            if (this.image) { notification.image = this.image; }
            if (this.devices) { notification.devices = this.devices; }

            if (this.responses) {
               notification.actions = [];

               for (var i = 0; i < this.responses.length; ++i) {

                  notification.actions.push({ name: this.responses[i].label, keepNotification: this.responses[i].hasOwnProperty("keepNotification") ? this.responses[i].keepNotification : false,
                                              url: this.responses[i].http.url, runOnServer: false,
                                              urlBackgroundOptions: { httpMethod: this.responses[i].http.method, httpContentType: this.responses[i].http.contentType, httpBody: JSON.stringify(this.responses[i].http.body)}});

                  if (this.responses[i].default) {
                     notification.actions.push({ name: this.responses[i].label, url: this.responses[i].http.url, runOnServer: false,
                                                 urlBackgroundOptions: { httpMethod: this.responses[i].http.method, httpContentType: this.responses[i].http.contentType, httpBody: JSON.stringify(this.responses[i].http.body)}});
                  }
               }
            }

            this.owner.notifyUser(this.user, notification, this);
            break;
         }
      }
      _callback(null, true);
   }
   catch (_error) {
      _callback(_error);
   }
};

module.exports = exports = PushcutNotifier;
