var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function ListeningSource(_config) {
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;

   Source.call(this, _config);

   this.establishListeners();

   var that = this;
}

util.inherits(ListeningSource, Source);

ListeningSource.prototype.establishListeners = function() {
   var that = this;

   // Listener callbacks
   this.activeCallback = function(_data) {
      that.sourceIsActive(_data);
   };

   this.inactiveCallback = function(_data) {
      that.sourceIsInactive(_data);
   };

   this.propertyChangedCallback = function(_data) {
      that.sourcePropertyChanged(_data);
   };

   this.invalidCallback = function(_data) {
      that.sourceIsInvalid(_data);
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceEnabled) {
      this.source.on('active', this.activeCallback);
      this.source.on('inactive', this.inactiveCallback);
      this.source.on('property-changed', this.propertyChangedCallback);
      this.source.on('invalid', this.invalidCallback);
   }

   return this.sourceEnabled;
}

ListeningSource.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceEnabled)  {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

ListeningSource.prototype.sourceIsInvalid = function() {
   console.log(this.name + ': INVALID');

   this.sourceEnabled = false;
   this.source.removeListener('active', this.activeCallback);
   this.source.removeListener('inactive', this.inactiveCallback);
   this.source.removeListener('property-changed', this.propertyChangedCallback);
   this.source.removeListener('invalid', this.invalidCallback);

   this.goInvalid({ sourceName: this.name });
}

module.exports = exports = ListeningSource;
 
