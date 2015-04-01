var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function LogicActivator(_config) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

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
   this.sourceEnabled = false;

   // Define listening callbacks
   var activeCallback = function(_data) {
      that.oneSourceIsActive(_data);
   };

   var inactiveCallback = function(_data) {
      that.oneSourceIsInactive(_data);
   };

   var invalidCallback = function(_data) {
      var oldSourceEnabled = that.sourceEnabled;
      var len = that.inputs.length;

      for (var i = 0; i < len; ++i) {

         if (that.inputs[i].source.sourceName == _data.sourceName) {
            that.inputs[i].source.removeListener('active', activeCallback);
            that.inputs[i].source.removeListener('inactive', inactiveCallback);
            that.inputs[i].source.removeListener('invalid', invalidCallback);
            that.inputs[i].splice(i, 1);

            if (that.allInputsRequiredForValidity) {
               that.sourceEnabled = false;
            }
         }
      }

      // Has the enabled stated changed from true to false?
      if (oldSourceEnabled && !that.sourceEnabled) {
         // If so, tell the others guys that I am now invalid
         that.emit('invalid', { sourceName: that.name });
      }
   };

   // Remove old inputs
   this.inputs.forEach(function(_sourceName, _index) {
      that.inputs[_index].source.removeListener('active', activeCallback);
      that.inputs[_index].source.removeListener('inactive', inactiveCallback);
      that.inputs[_index].source.removeListener('invalid', invalidCallback);
   });

   // Clear the existing array, this seems to be the way most people like on the web
   this.inputs.length = 0;
   tempSources.length = 0;

   // Attach sources again, perform the refresh
   var len = this.inputNames.length;

   for (var i = 0; i < len; ++i) {
      var source = this.casaSys.findSource(this.inputNames[i]);

      if (source && source.sourceEnabled) {
         tempSources.push( { source: source, active: false });
      }
   }

   if (!this.allInputsRequiredForValidity || tempSources.length == this.inputNames.length) {
      this.inputs = tempSources;

      this.inputs.forEach(function(_sourceName, _index) {
         that.inputs[_index].source.on('active', activeCallback);
         that.inputs[_index].source.on('inactive', inactiveCallback);
         that.inputs[_index].source.on('invalid', invalidCallback);
      });

      this.sourceEnabled = true;
   }

   return this.sourceEnabled;
}

LogicActivator.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceEnabled || !this.allInputsRequiredForValidity) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

LogicActivator.prototype.oneSourceIsActive = function(_data) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' active!');

   // find the input in my array
   items = this.inputs.filter(function(_item) {
      return (_item.source.name == _sourceName);
   });

   // set source input to active
   items.forEach(function(_item) {
      _item.active = true;
   });

   this.emitIfNecessary(_data);
}

LogicActivator.prototype.oneSourceIsInactive = function(_data) {
   console.log(this.name + ' : Input source ' + _data.sourceName + ' inactive!');
         
   // find the input in my array
   items = this.inputs.filter(function(_item) {
      return (_item.source.name == _sourceName);
   });

   // set source input to inactive
   items.forEach(function(_item) {
      _item.active = false;
   });

   this.emitIfNecessary(_data);
}

LogicActivator.prototype.emitIfNecessary = function(_data) {

   var res = this.checkActivate();

   if (this.active) {

      if (!res) {
         this.active = false;

         if (_data.coldStart) {
            this.emit('inactive', { sourceName: this.name, coldStart: true });
         }
         else {
            this.emit('inactive', { sourceName: this.name });
         }
      }
   } else if (res) {
      this.active = true;

      if (_data.coldStart) {
         this.emit('active', { sourceName: this.name, coldStart: true });
      }
      else {
         this.emit('active', { sourceName: this.name });
      }
   }
}

LogicActivator.prototype.isActive = function() {
   return this.active;
}

module.exports = exports = LogicActivator;
