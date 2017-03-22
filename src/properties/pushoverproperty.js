var util = require('util');
var OutputStepProperty = require('../outputstepproperty');

function PushoverProperty(_config, _owner) {

   _config.outputStep = { type: 'pushoverstep',
                          priority: _config.priority,
                          userGroup: _config.userGroup };

   _config.allSourcesRequiredForValidity = false;
   OutputStepProperty.call(this, _config, _owner);
}

util.inherits(PushoverProperty, OutputStepProperty);

module.exports = exports = PushoverProperty;
