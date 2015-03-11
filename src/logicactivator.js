var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function LogicActivator(_config) {

   this.name = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   var sources = [];

   events.EventEmitter.call(this);

   this.inputs = [];
   this.inputNames = [];

   this.casa.addActivator(this);

   this.active = false;

   var that = this;

   _config.sources.forEach(function(_sourceName, _index) {
      that.inputNames.push(_sourceName);
   });

   this.establishListeners();
}

util.inherits(LogicActivator, events.EventEmitter);

LogicActivator.prototype.establishListeners = function() {
   var that = this;
   var tempSources = [];
   this.activatorEnabled = false;

   var len = this.inputNames.length;
   for (var i = 0; i < len; ++i) {
      var source = this.casaSys.findSource(this.inputNames[i]);
      if (!source) {
         break;
      }
      tempSources.push( { source: source, active: false });
   }

   if (tempSources.length == this.inputNames.length) {
      this.inputs = tempSources;

      this.inputs.forEach(function(_sourceName, _index) {

         var activeCallback = function(_data) {
            that.oneSourceIsActive(_data.sourceName);
         };

         var inactiveCallback = function(_data) {
            that.oneSourceIsInactive(_data.sourceName);
         };

         var invalidCallback = function(_data) {
            this.activatorEnabled = false;
            var len = that.inputs.length;

            for (var i = 0; i < len; ++i) {
               that.inputs[i].source.removeListener('active', activeCallback);
               that.inputs[i].source.removeListener('inactive', inactiveCallback);
               that.inputs[i].source.removeListener('invalid', invalidCallback);
            }
            that.emit('invalid');
         };

         that.inputs[_index].source.on('active', activeCallback);
         that.inputs[_index].source.on('inactive', inactiveCallback);
         that.inputs[_index].source.on('invalid', invalidCallback);
      });

      this.activatorEnabled = true;
   }

   return this.activatorEnabled;
}

LogicActivator.prototype.refreshSources = function() {
   var ret = true;

   if (!this.activatorEnabled) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

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

LogicActivator.prototype.invalidateSource = function() {

   if (this.activatorEnabled) {
      this.activatorEnabled = false;
      this.emit('invalid');
   }
}

module.exports = exports = LogicActivator;
