var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function LogicActivator(_config) {
   this.name = _config.name;

   var casaSys = CasaSystem.mainInstance();
   this.casa = casaSys.findCasa(_config.casa);

   var sources = [];

   events.EventEmitter.call(this);

   this.inputs = [];
   this.active = false;

   this.casa.addActivator(this);

   var that = this;

   _config.sources.forEach(function(_sourceName, _index) {
      var source = casaSys.findSource(_sourceName);
      console.log(that.name + ': Sourcename= ' + _sourceName + ' res = ' + source.name);
      that.inputs.push( { source : source, active : false });

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
