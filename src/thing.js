var util = require('util');
var Source = require('./source');

function Thing(_config) {
   this.displayName = _config.displayName;
   this.sourceType = "thing";

   this.sources = {};
   this.actions = {};

   Source.call(this, _config);

   if (this.casa) {
      console.log('Thing casa: ' + this.casa.name);
      this.casa.addThing(this);
   }

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


Thing.prototype.setProperty = function(_propName, _propValue, _callback) {
   this.changePropertyAndEmit(_propName, _propValue, _callback);
};

module.exports = exports = Thing;
