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

         that.inputs[_index].source.on('active', function (_data) {
            that.oneSourceIsActive(_data.sourceName);
         });

         that.inputs[_index].source.on('inactive', function (_data) {
            that.oneSourceIsInactive(_data.sourceName);
         });

         that.inputs[_index].source.on('invalid', function (_data) {
            this.activatorEnabled = false;
            var len = that.inputs.length;

            for (var i = 0; i < len; ++i) {
               that.inputs[i].source.removeListener('active', that);
               that.inputs[i].source.removeListener('inactive', that);
               that.inputs[i].source.removeListener('invalid', that);
            }
            that.emit('invalid');
         });
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
