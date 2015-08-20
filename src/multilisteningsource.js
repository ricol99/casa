var util = require('util');
var Source = require('./source');
var MultiSourceListener = require('./multisourcelistener');
var CasaSystem = require('./casasystem');

function MultiListeningSource(_config) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

   this.casaSys = CasaSystem.mainInstance();

   Source.call(this, _config);

   this.sourceEnabled = false;
   this.multiSourceListener = new MultiSourceListener(_config, this);

   var that = this;
}

util.inherits(MultiListeningSource, Source);

MultiListeningSource.prototype.sourceIsInvalid = function(_data) {
   this.sourceEnabled = false;
   this.goInvalid(_data);
}

MultiListeningSource.prototype.sourceIsValid = function(_data) {
   this.sourceEnabled = true;
}

MultiListeningSource.prototype.oneSourceIsActive = function(_data, _sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

MultiListeningSource.prototype.oneSourceIsInactive = function(_data, _sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

MultiListeningSource.prototype.oneSourcePropertyChanged = function(_data, _sourceListener, _sourceAttributes) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = MultiListeningSource;
