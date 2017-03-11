var util = require('util');
var SourceStepProperty = require('../sourcestepproperty');

function DelayProperty(_config, _owner) {
   _config.sourceStep = { type: 'delaystep', delay: _config.delay };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(DelayProperty, SourceStepProperty);

module.exports = exports = DelayProperty;
