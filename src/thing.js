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

Thing.prototype.addAction = function(_action) {
   this.actions[_action.name] = _action;

   _action.on('activated', function (_data) {
      console.log(this.name + ': ' + _data.sourceName + ' has been activated');
   });

   _action.on('deactivated', function (_data) {
      console.log(this.name + ': ' + _data.sourceName + ' has been deactivated');
   });

   console.log(this.name + ': ' + _action.name + ' associated!');
};

module.exports = exports = Thing;
