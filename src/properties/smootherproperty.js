var util = require('util');
var SourceStepProperty = require('../sourcestepproperty');

function SmootherProperty(_config, _owner) {

   _config.sourceStep = { type: 'smootherstep', rate: _config.rate,
                          resolution: _config.resolution, floorOutput: _config.floorOutput };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(SmootherProperty, SourceStepProperty);

module.exports = exports = SmootherProperty;
