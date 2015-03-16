var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Activator(_config) {

   this.name = _config.name;
   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.casa = this.casaSys.casa;

   this.minOutputTime = (_config.minOutputTime) ? _config.minOutputTime : 0;
   this.inputDebounceTime = (_config.inputDebounceTime) ? _config.inputDebounceTime : 0;
   this.invert = (_config.invert) ? _config.invert : false;

   if (this.casa) {
      console.log('Activator casa: ' + this.casa.name);
      this.casa.addActivator(this);
   }

   this.coldStart = true;

   this.destActivated = false;
   this.sourceActive = false;
   this.minOutputTimeObj = null;

   var that = this;

   events.EventEmitter.call(this);

   this.establishListeners();
}

util.inherits(Activator, events.EventEmitter);

Activator.prototype.establishListeners = function() {
   var that = this;

   // Listener callbacks
   var activeCallback = function(_data) {
      that.sourceIsActive(_data.sourceName);
   };

   var inactiveCallback = function(_data) {
      that.sourceIsInactive(_data.sourceName);
   };

   var invalidCallback = function(_data) {
      console.log(that.name + ': INVALID');

      that.sourceEnabled = false;
      that.source.removeListener('active', activeCallback);
      that.source.removeListener('inactive', inactiveCallback);
      that.source.removeListener('invalid', invalidCallback);

      if (this.inputDebounceTime > 0) {
         // restore the source
         delete that.source;
         that.source = that.origSource;
      }
      that.emit('invalid', { sourceName: that.name });
   };

   // refresh source
   this.source = this.casaSys.findSource(this.sourceName);
   this.sourceEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceEnabled) {

      if (this.inputDebounceTime > 0) {
         this.origSource = this.source;
         this.source = new InputDebouncer(this.source, this.inputDebounceTime);
         console.log(this.name + ': Created input debouncer');
      }

      this.source.on('active', activeCallback);
      this.source.on('inactive', inactiveCallback);
      this.source.on('invalid', invalidCallback);

   }
   return this.sourceEnabled;
}

Activator.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceEnabled) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

Activator.prototype.sourceIsActive = function(_sourceName) {
   console.log('source ' + _sourceName + ' active!');
   
   if (this.coldStart) {
      this.coldStart = false;
      this.destActivated = false;
   }

   this.sourceActive = true;

   if (this.destActivated) {
      this.restartTimer();
   }
   else {
      this.activateDestination();
   }
}

Activator.prototype.sourceIsInactive = function(_sourceName) {
   console.log('source ' + _sourceName + ' inactive!');

   if (this.coldStart) {
      this.coldStart = false;
      this.destActivated = true;
   }

   this.sourceActive = false;

   if (this.destActivated) {

      // Destination is active. If there is no minOutputTime, deactivate. Else, let the timer do it
      if (this.minOutputTime == 0) {
         this.deactivateDestination();
      }
   }
}

Activator.prototype.activateDestination = function() {
   this.destActivated = true;
   this.emit(this.invert ? 'inactive' : 'active', { sourceName: this.name }); 
}

Activator.prototype.deactivateDestination = function() {
   this.destActivated = false;
   this.emit(this.invert ? 'active' : 'inactive', { sourceName: this.name }); 
}

Activator.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.deactivateDestination();
      that.minOutputTimeObj = null;
   }, this.minOutputTime*1000);
}

function InputDebouncer(_source, _threshold) {
   this.source = _source;
   this.threshold = _threshold;
   this.timeoutObj = null;
   this.sourceActive = false;
   this.coldStart = true;
   this.sourceEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   var activeCallback = function(_data) {

      if (that.coldStart) {
         that.coldStart = false;
         that.sourceActive = false;
      }

      if (!that.sourceActive) {
         that.sourceActive = true;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

            // Activating
            that.timeoutObj = setTimeout(function() {
               that.timeoutObj = null;

               if (!that.sourceEnabled) {
                  that.emit('invalid', { sourceName: that.source.name });
               } 
               else if (that.sourceActive) {
                  that.emit('active', { sourceName: that.source.name });
               }
            }, that.threshold*1000);
         }
      }
   };

   var inactiveCallback = function(_data) {

      if (that.coldStart) {
         that.coldStart = false;
         that.sourceActive = true;
      }

      if (that.sourceActive) {
         that.sourceActive = false;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

            // Deactivating
            that.timeoutObj = setTimeout(function() {
               that.timeoutObj = null;

               if (!that.sourceEnabled) {
                  that.emit('invalid', { sourceName: that.source.name });
               }
               else if (!that.sourceActive) {
                  that.emit('inactive', { sourceName: that.source.name });
               }
            }, that.threshold*1000);
         }
      }
   };

   var invalidCallback = function(_data) {

      if (that.sourceEnabled) {
         that.sourceEnabled = false;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

            // Deactivating
            that.timeoutObj = setTimeout(function() {
               that.timeoutObj = null;

               if (!that.sourceEnabled) {
                  that.emit('invalid', { sourceName: that.source.name });
               }
               else if (that.sourceActive) {
                  that.emit('active', { sourceName: that.source.name });
               }
               else {
                  that.emit('inactive', { sourceName: that.source.name });
               }
            }, that.threshold*1000);
         }
      }
      that.source.removeListener('active', activeCallback);
      that.source.removeListener('inactive', inactiveCallback);
      that.source.removeListener('invalid', invalidCallback);
   };

   this.source.on('active', activeCallback);
   this.source.on('inactive', inactiveCallback);
   this.source.on('invalid', invalidCallback);
}

util.inherits(InputDebouncer, events.EventEmitter);

module.exports = exports = Activator;
