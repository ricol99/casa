var util = require('util');
var events = require('events');
var Activator = require('./activator');

function LogicActivator(_name, _sources, _timeout, _invert) {
   this.inputs = [];

   Activator.call(this, _name, this, _timeout, _invert);

   var that = this;

   var index = 0;
   _sources.forEach(function(_source) {
      that.inputs.push( { source : _source, active : false });

      that.inputs[index].source.on('activate', function (sourceName) {
         sourceActive(sourceName);
      });

      that.inputs[index].source.on('active', function (sourceName) {
         sourceActive(sourceName);
      });

      var sourceActive = function(sourceName) {
         console.log(that.name + ': Input source ' + sourceName + ' active!');
         
         // find the input in my array
         items = that.inputs.filter(function(item) {
           return (item.source.name == sourceName);
         });

         // set source input to active
         items.forEach(function(item) {
           item.active = true;
         });

         if (that.checkActivate(that.inputs)) {
            that.emit('active', that.name);
         }
      }

      that.inputs[index].source.on('deactivate', function (sourceName) {
         sourceInactive(sourceName);
      });

      that.inputs[index].source.on('deactivate', function (sourceName) {
         sourceInactive(sourceName);
      });

      var sourceInactive = function(sourceName) {
         console.log(that.name + ' : Input source ' + sourceName + ' inactive!');
         
         // find the input in my array
         items = that.inputs.filter(function(item) {
           return (item.source.name == sourceName);
         });

         // set source input to inactive
         items.forEach(function(item) {
           item.active = false;
         });

         if (that.checkDeactivate(that.inputs)) {
            that.emit('inactive', that.name);
         }
      }

      index++;
   });
}

util.inherits(LogicActivator, Activator);

module.exports = exports = LogicActivator;
