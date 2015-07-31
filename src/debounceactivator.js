var util = require('util');
var ListeningSource = require('./listeningsource');

function DebounceActivator(_config) {

   this.threshold = _config.threshold;
   this.timeoutObj = null;
   this.sourceActive = false;

   ListeningSource.call(this, _config);

   var that = this;
}

util.inherits(DebounceActivator, ListeningSource);

DebounceActivator.prototype.sourceIsActive = function(_data) {
   var that = this;
   console.log(this.name + ':source ' + _data.sourceName + ' active!');

   if (_data.coldStart || this.active) {
      this.sourceActive = true;
      this.goActive(_data);
   }
   else if (!this.sourceActive) {
      this.sourceActive = true;
      this.storedActiveData = _data;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         // Activating
         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (!that.source || !that.sourceEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
            else if (that.sourceActive) {
               that.goActive(that.storedActiveData);
            }
         }, this.threshold*1000);
      }
   } else {
      this.storedActiveData = _data;
   }
};

DebounceActivator.prototype.sourceIsInactive = function(_data) {
   var that = this;
   console.log(this.name + ': source ' + _data.sourceName + ' inactive!');

   if (_data.coldStart || !this.active) {
      this.sourceActive = false;
      this.goInactive(_data);
   }
   else if (this.sourceActive) {
      this.sourceActive = false;
      this.storedInactiveData = _data;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         // Deactivating
         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (that.source && !that.sourceActive) {
               that.goInactive(_data);
               that.emit(that.storedInactiveData);
            }

            if (!that.sourceEnabled) {
               that.goInvalid({ sourceName: that.name });
            }

         }, this.threshold*1000);
      }
   }
};

DebounceActivator.prototype.sourceIsInvalid = function(_data) {
   var that = this;
   console.log('source ' + _data.sourceName + ' invalid!');

   if (this.sourceEnabled) {
      this.sourceEnabled = false;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {

         this.timeoutObj = setTimeout(function() {
            that.timeoutObj = null;

            if (!that.sourceEnabled) {
               that.goInvalid({ sourceName: that.name });
            }
            else if (that.sourceActive) {
               that.goActive(that.storedActiveData);
            }
            else {
               that.goInactive(that.storedInactiveData);
            }
         }, this.threshold*1000);
      }

      this.source.removeListener('active', this.activeCallback);
      this.source.removeListener('inactive', this.inactiveCallback);
      this.source.removeListener('property-changed', this.propertyChangedCallback);
      this.source.removeListener('invalid', this.invalidCallback);
   }
};

module.exports = exports = DebounceActivator;
