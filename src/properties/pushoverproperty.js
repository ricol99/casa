var util = require('util');
var push = require( 'pushover-notifications' );
var Gang = require('../gang');
var Property = require('../property');

function PushoverProperty(_config, _owner) {
   this.messagePriority = (_config.priority) ? _config.priority : 0;
   _config.allSourcesRequiredForValidity = false;

   Property.call(this, _config, _owner);

   this.gang = Gang.mainInstance();
   this.userGroup = this.gang.findNamedObject(_config.userGroup);

   if (!this.userGroup) {
      console.error(this.uName + ": ***** UserGroup not found! *************");
      process.exit(1);
   }

   this.pushService = this.gang.casa.findService("pushoverservice");

   if (!this.pushService) {
      console.error(this.uName + ": ***** Pushover service not found! *************");
      process.exit(1);
   }
}

util.inherits(PushoverProperty, Property);

PushoverProperty.prototype.propertyAboutToChange = function(_newValue, _data) {

   if (_data.coldStart) {
      return;
   }

   this.pushService.sendMessage(this.userGroup.getProperty('pushoverDestAddr'), this.messagePriority, _newValue);
};

module.exports = exports = PushoverProperty;
