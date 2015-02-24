var util = require('util');
var events = require('events');
var Activator = require('./activator');

function LogicActivator(_name, _sources, _casa) {
   this.name = _name;
   this.casa = _casa;
   this.inputs = [];

   if (this.casa) {
      console.log('Activator casa: ' + this.casa.name);
      this.casa.addActivator(this);
   }

   this.active = false;

   events.EventEmitter.call(this);

   var that = this;

   _sources.forEach(function(_source, _index) {
      that.inputs.push( { source : _source, active : false });

      that.inputs[_index].source.on('active', function (sourceName) {
         that.oneSourceIsActive(sourceName);
      });

      that.inputs[_index].source.on('inactive', function (sourceName) {
         that.oneSourceIsInactive(sourceName);
      });
   });
}

util.inherits(LogicActivator, events.EventEmitter);

LogicActivator.prototype.oneSourceIsActive = function(sourceName) {
   console.log(this.name + ': Input source ' + sourceName + ' active!');

   // find the input in my array
   items = this.inputs.filter(function(item) {
      return (item.source.name == sourceName);
   });

   // set source input to active
   items.forEach(function(item) {
      item.active = true;
   });

   this.emitIfNecessary();
}

LogicActivator.prototype.oneSourceIsInactive = function(sourceName) {
   console.log(this.name + ' : Input source ' + sourceName + ' inactive!');
         
   // find the input in my array
   items = this.inputs.filter(function(item) {
      return (item.source.name == sourceName);
   });

   // set source input to inactive
   items.forEach(function(item) {
      item.active = false;
   });

   this.emitIfNecessary();
}

LogicActivator.prototype.emitIfNecessary = function() {

   var res = this.checkActivate();

   if(this.active) {

      if (!res) {
         this.active = false;
         this.emit('inactive', this.name);
      }

   } else if (res) {
      this.active = true;
      this.emit('active', this.name);
   }
}

module.exports = exports = LogicActivator;
