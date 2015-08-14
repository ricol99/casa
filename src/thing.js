var util = require('util');
var Source = require('./source');

function Thing(_config) {
   this.displayName = _config.displayName;

   this.sources = {};
   this.actions = {};

   Source.call(this, _config);

   var that = this;

}

util.inherits(Thing, Source);

Thing.prototype.addSource = function(_source) {
   this.sources[_source.name] = _source;
};

module.exports = exports = Thing;
