var util = require('util');
var PipelineStep = require('../pipelinestep');
var push = require( 'pushover-notifications' );
var Gang = require('../gang');

function PushoverStep(_config, _pipeline) {
   this.messagePriority = (_config.priority) ? _config.priority : 0;

   this.gang = Gang.mainInstance();
   this.userGroup = this.gang.findNamedObject(_config.userGroup);

   if (!this.userGroup) {
      console.error(this.uName + ": ***** UserGroup not found! *************");
      process.exit(1);
   }

   PipelineStep.call(this, _config, _pipeline);

   this.pushService = this.gang.casa.findService("pushoverservice");

   if (!this.pushService) {
      console.error(this.uName + ": ***** Pushover service not found! *************");
      process.exit(1);
   }
}

util.inherits(PushoverStep, PipelineStep);

PushoverStep.prototype.process = function(_value, _data) {

   if (_data.coldStart) {
      return;
   }

   this.pushService.sendMessage(this.userGroup.getProperty('pushoverDestAddr'), this.messagePriority, _value);
   this.outputForNextStep(_value, _data);
}

module.exports = exports = PushoverStep;

