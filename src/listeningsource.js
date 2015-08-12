var util = require('util');
var Source = require('./source');
var SourceListener = require('./sourcelistener');
var CasaSystem = require('./casasystem');

function ListeningSource(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;

   Source.call(this, _config);

   this.sourceEnabled = false;
   this.sourceListener = new SourceListener(_config, this);
   this.source = this.sourceListener.source;

   var that = this;
}

util.inherits(ListeningSource, Source);

ListeningSource.prototype.sourceIsValid = function() {
   this.sourceEnabled = true;

   // Cope with constructor calling back so sourceListener is not yet defined!
   if (this.sourceListener) {
     this.source = this.sourceListener.source;
   }
}

ListeningSource.prototype.sourceIsInvalid = function(_data) {
   console.log(this.name + ': INVALID');

   this.sourceEnabled = false;
   this.source = null;

   this.goInvalid({ sourceName: this.name });
}

ListeningSource.prototype.sourceIsActive = function(_data) {
   // DO NOTHING BY DEFAULT
}

ListeningSource.prototype.sourceIsInactive = function(_data) {
   // DO NOTHING BY DEFAULT
}

ListeningSource.prototype.sourcePropertyChanged = function() {
   // DO NOTHING BY DEFAULT
}

module.exports = exports = ListeningSource;
 
