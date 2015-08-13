var util = require('util');
var events = require('events');
var MultiSourceListener = require('./multisourcelistener');
var CasaSystem = require('./casasystem');

function Action(_config) {

   this.name = _config.name;

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.actionEnabled = false;
   this.actionActive = false;
   this.sourceName = _config.source;
   this.targetName = (_config.target) ? _config.target : null;

   events.EventEmitter.call(this);

   var that = this;

   var configSources = [];
   configSources.push(_config.source);

   if (_config.target) {
      configSources.push(_config.target);
   }

   this.multiSourceListener = new MultiSourceListener({ name: this.name, sources: configSources, allInputsRequiredForValidity: true }, this);

   this.source = this.multiSourceListener.sourceListeners[this.sourceName].source;
   this.target = this.multiSourceListener.sourceListeners[this.targetName].source;

   this.casa.addAction(this);
}

util.inherits(Action, events.EventEmitter);

Action.prototype.sourceIsInvalid = function(_data) {
   this.actionEnabled = false;
   this.source = null;
   this.target = null;
   that.emit('invalid', { sourceName: that.name });
}

Action.prototype.sourceIsValid = function(_data) {
   this.actionEnabled = true;

   if (this.multiSourceListener) {
      this.source = this.multiSourceListener.sourceListeners[this.sourceName].source;
      this.target = this.multiSourceListener.sourceListeners[this.targetName].source;
   }
}

Action.prototype.oneSourceIsActive = function(_data, _sourceListener, _sourceAttributes) {
   console.log(this.name + ': ACTIVATED', _data);

   if (_data.sourceName == this.sourceName && this.actionEnabled) {

      this.actionActive = true;

      if (_data.coldStart) {
         this.emit('activated-from-cold', _data);
      }
      else {
         this.emit('activated', _data);
      }
   }
}

Action.prototype.oneSourceIsInactive = function(_data, sourceListener, _sourceAttributes) {
   console.log(this.name + ': DEACTIVATED', _data);

   if (_data.sourceName == this.sourceName && this.actionEnabled) {
      this.actionActive = false;

      if (_data.coldStart) {
         this.emit('deactivated-from-cold', _data);
      }
      else {
         this.emit('deactivated', _data);
      }
   }
}

Action.prototype.oneSourcePropertyChanged = function(_data, sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

Action.prototype.isActive = function() {
   return this.actionActive;
}

module.exports = exports = Action;

