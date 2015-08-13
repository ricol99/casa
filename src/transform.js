var util = require('util');
var Worker = require('./worker');

function Transform(_config) {

   Worker.call(this, _config);

   var that = this;
}

util.inherits(Transform, Worker);

Transform.prototype.oneSourcePropertyChanged = function(_data, sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = Transform;

