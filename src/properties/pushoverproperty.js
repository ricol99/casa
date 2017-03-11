var util = require('util');
var SourceStepProperty = require('../sourcestepproperty');

function PushoverProperty(_config, _owner) {

   _config.sourceStep = { type: 'pushoverstep',
                          priority: _config.priority,
                          userGroup: _config.userGroup };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(PushoverProperty, SourceStepProperty);

module.exports = exports = PushoverProperty;
