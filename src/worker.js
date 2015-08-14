var util = require('util');
var events = require('events');
var MultiSourceListener = require('./multisourcelistener');
var CasaSystem = require('./casasystem');

function Worker(_config) {

   this.name = _config.name;

   // Resolve source and target
   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;
   this.workerEnabled = false;

   events.EventEmitter.call(this);

   var that = this;

   this.sourceName = _config.source;

   var configSources = [];
   configSources.push(_config);

   if (_config.target) {
      configSources.push({ source: _config.target });
      this.targetName = _config.target;
   }

   this.multiSourceListener = new MultiSourceListener({ name: this.name, sources: configSources, allInputsRequiredForValidity: true }, this);

   this.source = this.multiSourceListener.sourceListeners[this.sourceName].source;

   if (this.targetName) {
      this.target = this.multiSourceListener.sourceListeners[this.targetName].source;
   }

   this.casa.addWorker(this);
}

util.inherits(Worker, events.EventEmitter);

Worker.prototype.sourceIsInvalid = function(_data) {
   this.workerEnabled = false;
   this.source = null;
   this.target = null;
   this.emit('invalid', { sourceName: this.name });
}

Worker.prototype.sourceIsValid = function(_data) {
   this.workerEnabled = true;

   if (this.multiSourceListener) {
      this.source = this.multiSourceListener.sourceListeners[this.sourceName].source;

      if (this.targetName) {
         this.target = this.multiSourceListener.sourceListeners[this.targetName].source;
      }
   }
}

Worker.prototype.oneSourceIsActive = function(_data, _sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

Worker.prototype.oneSourceIsInactive = function(_data, sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

Worker.prototype.oneSourcePropertyChanged = function(_data, sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = Worker;

