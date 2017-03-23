var util = require('util');
var SourceStepProperty = require('../sourcestepproperty');

function EdgeProperty(_config, _owner) {

   _config.sourceStep = { type: 'edgestep', 
                          leadingEdgeOutput: _config.leadingEdgeOutput,
                          trailingEdgeOutput: _config.trailingEdgeOutput };

   SourceStepProperty.call(this, _config, _owner);
}

util.inherits(EdgeProperty, SourceStepProperty);

module.exports = exports = EdgeProperty;
