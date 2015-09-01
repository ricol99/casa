var util = require('util');
var Source = require('./source');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function Activator(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;

   Source.call(this, _config);

   this.sourceEnabled = false;

   _config.defaultTriggerConditions = true;
   this.sourceListener = new SourceListener(_config, this);
   this.source = this.sourceListener.source;

   this.sourceEnabled = (this.source != null);

   var that = this;
}

util.inherits(Activator, Source);

Activator.prototype.sourceIsValid = function() {
   this.sourceEnabled = true;

   // Cope with constructor calling back so sourceListener is not yet defined!
   if (this.sourceListener) {
     this.source = this.sourceListener.source;
   }
}

Activator.prototype.sourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   this.sourceEnabled = false;
   this.source = null;

   this.goInvalid('ACTIVE', { sourceName: this.name });
}

Activator.prototype.sourceIsActive = function(_data) {
   // DO NOTHING BY DEFAULT
}

Activator.prototype.sourceIsInactive = function(_data) {
   // DO NOTHING BY DEFAULT
}

Activator.prototype.sourcePropertyChanged = function(_data) {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = Activator;
 
