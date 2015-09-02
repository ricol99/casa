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
   this.sourcePropertyName = _config.source + '::' + ((_config.sourceProperty == undefined) ? 'ACTIVE' : _config.sourceProperty );

   if (_config.target) {
      configSources.push({ source: _config.target });
      this.targetName = _config.target;
      this.targetPropertyName = _config.target + '::ACTIVE';
   }

   this.multiSourceListener = new MultiSourceListener({ name: this.name, sources: configSources, allInputsRequiredForValidity: true, defaultTriggerConditions: true }, this);

   this.source = this.multiSourceListener.sourceListeners[this.sourcePropertyName].source;

   if (this.targetName) {
      this.target = this.multiSourceListener.sourceListeners[this.targetPropertyName].source;
   }

   this.casa.addWorker(this);
}

util.inherits(Worker, events.EventEmitter);

Worker.prototype.sourceIsInvalid = function(_data) {
   this.workerEnabled = false;
   this.source = null;
   this.target = null;
   this.emit('invalid', { sourceName: this.name, propertyName: 'ACTIVE' });
}

Worker.prototype.sourceIsValid = function(_data) {
   this.workerEnabled = true;

   if (this.multiSourceListener) {
      this.source = this.multiSourceListener.sourceListeners[this.sourcePropertyName].source;

      if (this.targetName) {
         this.target = this.multiSourceListener.sourceListeners[this.targetPropertyName].source;
      }
   }
}

Worker.prototype.oneSourceIsActive = function(_sourceListener, _sourceAttributes, _data) {

   if (_data.sourceName == this.sourceName) {
      this.sourceIsActive(_data);
   }
}

Worker.prototype.oneSourceIsInactive = function(sourceListener, _sourceAttributes, _data) {

   if (_data.sourceName == this.sourceName) {
      this.sourceIsInactive(_data);
   }
}

Worker.prototype.oneSourcePropertyChanged = function(sourceListener, _sourceAttributes, _data) {

   if (_data.sourceName == this.sourceName) {
      this.sourcePropertyChanged(_data);
   }
}

Worker.prototype.sourceIsActive = function(_data) {
   // DO NOTHING BY DEFAULT
}

Worker.prototype.sourceIsInactive = function(_data) {
   // DO NOTHING BY DEFAULT
}

Worker.prototype.sourcePropertyChanged = function(_data) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = Worker;

