var util = require('util');
var ServiceNode = require('./servicenode');

function PushcutNotifier(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.started = false;
   this.pusherSubscriptions = {};
   this.noOfPushcutNotifiers = 0;
}

util.inherits(PushcutNotifier, ServiceNode);

PushcutNotifier.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() serviceProperty=" + _subscription.serviceProperty + ", args = ", _subscription.args);

   if (!this.notifierUName) {
      this.notifierUName = _subscription.args.notifierUName;
      this.smeeUrl = _subscription.args.smeeUrl;
      this.title = _subscription.args.title;
      this.text = _subscription.args.text;
      this.sound = _subscription.args.sound;
      this.image = _subscription.args.image;
      this.devices = _subscription.args.devices;
      this.responses = _subscription.args.responses;
   }

   var users = [];

   for (var i = 0; i < _config.users.length; ++i) {
      users.push(this.gang.findNamedObject(_config.users[i].uName));
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
                  notification.actions.push({ name: this.responses[i].label, keepNotification: this.responses[i].keepNotification, url: this.smeeUrl, runOnServer: false,
                                              urlBackgroundOptions: { httpMethod: "POST", httpContentType: "application/json",
                                                                      httpBody: JSON.stringify({ "uName": this.notifierUName, "propName": this.responses[i].property,
                                                                                                 "propValue": this.responses[i].value})}});

                  if (this.responses[i].default) {
                     notification.defaultAction = { name: this.responses[i].label, url: this.smeeUrl,
                                                    urlBackgroundOptions: { httpMethod: "POST", httpContentType: "application/json", runOnServer: false,
                                                                            httpBody: JSON.stringify({ "uName": this.notifierUName, "propName": this.responses[i].property,
                                                                                                       "propValue": this.responses[i].value})}};
                  }
               }
            }
            this.owner.notifyUser(notification, this);
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
