var util = require('util');
var events = require('events');
var Activator = require('./activator');

function LogicActivator(_name, _sources, _timeout, _invert) {
   this.inputs = [];

   Activator.call(this, _name, this, _timeout, _invert);

   var that = this;

   _sources.forEach(function(_source, index) {
      that.inputs.push( { source : _source, active : false });

      that.inputs[index].source.on('activate', function (sourceName) {
         that.sourceIsActive(sourceName);
      });

      that.inputs[index].source.on('active', function (sourceName) {
         that.sourceIsActive(sourceName);
      });

      that.inputs[index].source.on('deactivate', function (sourceName) {
         that.sourceInactive(sourceName);
      });

      that.inputs[index].source.on('deactivate', function (sourceName) {
         that.sourceInactive(sourceName);
      });
   });
}

util.inherits(LogicActivator, Activator);

LogicActivator.prototype.sourceIsActive = function(sourceName) {
   console.log(this.name + ': Input source ' + sourceName + ' active!');
         
   // find the input in my array
   items = this.inputs.filter(function(item) {
      return (item.source.name == sourceName);
   });

   // set source input to active
   items.forEach(function(item) {
      item.active = true;
   });

   if (this.checkActivate(that.inputs)) {
      this.emit('active', that.name);
   }
}

LogicActivator.prototype.sourceIsInActive = function(sourceName) {
   console.log(that.name + ' : Input source ' + sourceName + ' inactive!');
         
   // find the input in my array
   items = this.inputs.filter(function(item) {
      return (item.source.name == sourceName);
   });

   // set source input to inactive
   items.forEach(function(item) {
      item.active = false;
   });

   if (this.checkDeactivate(that.inputs)) {
      this.emit('inactive', that.name);
   }
}

module.exports = exports = LogicActivator;
