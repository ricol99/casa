var util = require('util');
var Source = require('./source');
var events = require('events');
var CasaSystem = require('./casasystem');

function Activator(_config) {

   this.casaSys = CasaSystem.mainInstance();
   this.sourceName = _config.source;
   this.sourceType = "activator";
   this.casa = this.casaSys.casa;

   this.minOutputTime = (_config.minOutputTime) ? _config.minOutputTime : 0;
   this.inputDebounceTime = (_config.inputDebounceTime) ? _config.inputDebounceTime : 0;
   this.invert = (_config.invert) ? _config.invert : false;

   Source.call(this, _config);

   if (this.casa) {
      console.log('Activator casa: ' + this.casa.name);
      this.casa.addActivator(this);
   }

   this.coldStart = true;
   this.debouncingInvalidSource = false;

   this.destActivated = false;
   this.sourceActive = false;
   this.minOutputTimeObj = null;

   var that = this;


   this.establishListeners();
}

util.inherits(Activator, Source);

Activator.prototype.establishListeners = function() {
   var that = this;

   // Listener callbacks
   var activeCallback = function(_data) {
      that.sourceIsActive(_data);
   };

   var inactiveCallback = function(_data) {
      that.sourceIsInactive(_data);
   };

   var invalidCallback = function(_data) {
      console.log(that.name + ': INVALID');

      that.sourceEnabled = false;
      that.source.removeListener('active', activeCallback);
      that.source.removeListener('inactive', inactiveCallback);
      that.source.removeListener('invalid', invalidCallback);

      if (that.inputDebounceTime > 0) {
         // restore the source
         delete that.source;
         that.source = that.origSource;
      }
      that.emit('invalid', { sourceName: that.name });
   };

   if ((this.inputDebounceTime > 0) && this.debouncingInvalidSource) {
      this.debouncingInvalidSource = false;
      return this.source.refreshSource();
   }
   else {
      // refresh source
      this.source = this.casaSys.findSource(this.sourceName);
      this.sourceEnabled = (this.source != null && this.source.sourceEnabled);

      if (this.sourceEnabled) {

         if (this.inputDebounceTime > 0) {
            this.origSource = this.source;
            this.source = new InputDebouncer(this.source, this.inputDebounceTime, this);
            console.log(this.name + ': Created input debouncer');
         }

         this.sourceActive = this.source.isActive();
         this.source.on('active', activeCallback);
         this.source.on('inactive', inactiveCallback);
         this.source.on('invalid', invalidCallback);
      }
   }
   return this.sourceEnabled;
}

Activator.prototype.refreshSources = function() {
   var ret = true;

   if (!this.sourceEnabled || this.debouncingInvalidSource) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

Activator.prototype.sourceIsActive = function(_data) {
   console.log('source ' + _data.sourceName + ' active!');
   
   if (_data.coldStart) {
      this.destActivated = false;
   }

   this.sourceActive = true;

   if (this.destActivated) {
      this.restartTimer();
   }
   else {
      this.activateDestination(_data);
   }
}

Activator.prototype.sourceIsInactive = function(_data) {
   console.log('source ' + _data.sourceName + ' inactive!');

   if (_data.coldStart) {
      this.destActivated = true;
   }

   this.sourceActive = false;

   if (this.destActivated) {

      // Destination is active. If there is no timer, deactivate. Else, let the timer do it
      if (this.minOutputTimeObj == null) {
         this.deactivateDestination(_data);
      }
   }
}

Activator.prototype.activateDestination = function(_data) {
   this.destActivated = true;

   if (_data.coldStart) {
      this.emit(this.invert ? 'inactive' : 'active', { sourceName: this.name, coldStart: true }); 
   }
   else {
      this.emit(this.invert ? 'inactive' : 'active', { sourceName: this.name }); 
   }
}

Activator.prototype.deactivateDestination = function(_data) {
   this.destActivated = false;

   if (_data.coldStart) {
      this.emit(this.invert ? 'active' : 'inactive', { sourceName: this.name, coldStart: true }); 
   }
   else {
      this.emit(this.invert ? 'active' : 'inactive', { sourceName: this.name }); 
   }
}

Activator.prototype.restartTimer = function() {
   var that = this;

   if (this.minOutputTimeObj) {
      clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = setTimeout(function() {
      that.deactivateDestination( { coldStart: false });
      that.minOutputTimeObj = null;
   }, this.minOutputTime*1000);
}

function InputDebouncer(_source, _threshold, _activator) {
   this.source = _source;
   this.sourceName = _source.name;
   this.threshold = _threshold;
   this.activator = _activator;
   this.timeoutObj = null;
   this.sourceActive = this.source.isActive();
   this.sourceEnabled = true;

   events.EventEmitter.call(this);

   var that = this;

   this.activeCallback = function(_data) {

      if (_data.coldStart) {
         that.sourceActive = true;
         that.emit('active', { sourceName: that.source.name, coldStart: true });
      }
      else if (!that.sourceActive) {
         that.sourceActive = true;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

            // Activating
            that.timeoutObj = setTimeout(function() {
               that.timeoutObj = null;
               that.activator.debouncingInvalidSource = false;

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

   this.inactiveCallback = function(_data) {

      if (_data.coldStart) {
         that.sourceActive = false;
         that.emit('inactive', { sourceName: that.source.name, coldStart: true });
      }
      else if (that.sourceActive) {
         that.sourceActive = false;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

            // Deactivating
            that.timeoutObj = setTimeout(function() {
               that.timeoutObj = null;
               that.activator.debouncingInvalidSource = false;

               if (!that.sourceActive) {
                  that.emit('inactive', { sourceName: that.source.name });
               }

               if (!that.sourceEnabled) {
                  that.emit('invalid', { sourceName: that.source.name });
               }
            }, that.threshold*1000);
         }
      }
   };

   this.invalidCallback = function(_data) {
      if (that.sourceEnabled) {
         that.sourceEnabled = false;
         that.activator.debouncingInvalidSource = true;

         // If a timer is already running, ignore. ELSE create one
         if (that.timeoutObj == null) {

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
      that.source.removeListener('active', that.activeCallback);
      that.source.removeListener('inactive', that.inactiveCallback);
      that.source.removeListener('invalid', that.invalidCallback);
   };

   this.source.on('active', this.activeCallback);
   this.source.on('inactive', this.inactiveCallback);
   this.source.on('invalid', this.invalidCallback);
}

util.inherits(InputDebouncer, events.EventEmitter);


InputDebouncer.prototype.refreshSource = function() {
   this.source = this.activator.casaSys.findSource(this.sourceName);
   this.sourceEnabled = (this.source != null && this.source.sourceEnabled);

   if (this.sourceEnabled) {
      //this.sourceActive = this.source.isActive();
      console.log(this.source.name + ': Source state is now ' + this.sourceActive);
      this.source.on('active', this.activeCallback);
      this.source.on('inactive', this.inactiveCallback);
      this.source.on('invalid', this.invalidCallback);
   }
   return this.sourceEnabled;
}

Activator.prototype.coldStart = function() {
   // Do nothing
}

InputDebouncer.prototype.isActive = function() {
   return this.sourceActive;
}

Activator.prototype.isActive = function() {
   return (this.invert) ? !this.destActivated  : this.destActivated;
}

module.exports = exports = Activator;
