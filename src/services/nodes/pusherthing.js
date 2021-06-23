var util = require('util');
var ServiceNode = require('./servicenode');

function PusherThing(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
}

util.inherits(PusherThing, ServiceNode);

PusherThing.prototype.newSubscriptionAdded = function(_subscription) {
   console.log(this.uName + ": newSubscriptionAdded() args = ", _subscription.args);
   this.thingName = _subscription.args.thingName;
   
   this.start(_subscription.args.property);
};

PusherThing.prototype.start = function(_property) {

   if (!this.props.hasOwnProperty(_property)) {
      this.ensurePropertyExists(_property, 'property', { allSourcesRequiredForValidity: false }, this.config);
   }

   if (!this.started) {

      this.owner.channel.bind(this.thingName, (_data) => {

         if (_data && _data.hasOwnProperty("propName") && _data.hasOwnProperty("propValue") && this.props.hasOwnProperty(_data.propName)) {
            this.alignPropertyValue(_data.propName, _data.propValue);
         }
      });

      this.started = true;
   }
}

PusherThing.prototype.processPropertyChanged = function(_transaction, _callback) {
   // Do nothing, read only
   _callback(null, true);
};


module.exports = exports = PusherThing;
