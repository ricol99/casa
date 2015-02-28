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

      that.inputs[_index].source.on('active', function (_data) {
         that.oneSourceIsActive(_data.sourceName);
      });

      that.inputs[_index].source.on('inactive', function (_data) {
         that.oneSourceIsInactive(_data.sourceName);
      });
   });
}

util.inherits(LogicActivator, events.EventEmitter);

LogicActivator.prototype.oneSourceIsActive = function(_sourceName) {
   console.log(this.name + ': Input source ' + _sourceName + ' active!');

   // find the input in my array
   items = this.inputs.filter(function(_item) {
      return (_item.source.name == _sourceName);
   });

   // set source input to active
   items.forEach(function(_item) {
      _item.active = true;
   });

   this.emitIfNecessary();
}

LogicActivator.prototype.oneSourceIsInactive = function(_sourceName) {
   console.log(this.name + ' : Input source ' + _sourceName + ' inactive!');
         
   // find the input in my array
   items = this.inputs.filter(function(_item) {
      return (_item.source.name == _sourceName);
   });

   // set source input to inactive
   items.forEach(function(_item) {
      _item.active = false;
   });

   this.emitIfNecessary();
}

LogicActivator.prototype.emitIfNecessary = function() {

   var res = this.checkActivate();

   if(this.active) {

      if (!res) {
         this.active = false;
         this.emit('inactive', { sourceName: this.name });
      }

   } else if (res) {
      this.active = true;
      this.emit('active', { sourceName: this.name });
   }
}

module.exports = exports = LogicActivator;
