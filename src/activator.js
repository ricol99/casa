var util = require('util');
var events = require('events');
var CasaSystem = require('./casasystem');

function Activator(_name, _source, _minOutputTime, _invert, _inputDebounceTime, _casa) {

   this.source = null;
   this.name = null;
   this.minOutputTime = 0;
   this.invert = false;
   this.inputDebounceTime = 0;
   this.casa = null;

   if (_name.name) {
      // constructing from object rather than params
      var casaSys = CasaSystem.mainInstance();
      this.source = casaSys.findSource(_name.source);
      this.casa = casaSys.findCasa(_name.casa);
      this.name = _name.name;

      if (_name.minOutputTime) {
         this.minOutputTime = _name.minOutputTime;
      }

      if (_name.inputDebounceTime) {
         this.inputDebounceTime = _name.inputDebounceTime;
      }

      if (_name.invert) {
         this.invert = _name.invert;
      }
   }
   else {
      this.name = _name;
      this.source = _source;
      this.minOutputTime = _minOutputTime;
      this.invert = _invert;
      this.inputDebounceTime = _inputDebounceTime;
      this.casa = _casa;
   }

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

   if (this.inputDebounceTime > 0) {
      this.source = new InputDebouncer(this.source, this.inputDebounceTime);
      console.log('Created input debouncer');
   }

   this.source.on('active', function (sourceName) {
      that.sourceIsActive(sourceName);
   });

   this.source.on('inactive', function (sourceName) {
      that.sourceIsInactive(sourceName);
   });
}

util.inherits(Activator, events.EventEmitter);

Activator.prototype.sourceIsActive = function(sourceName) {
   console.log('source ' + sourceName + ' active!');
   
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

Activator.prototype.sourceIsInactive = function(sourceName) {
   console.log('source ' + sourceName + ' inactive!');

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
   this.emit(this.invert ? 'inactive' : 'active', this.name); 
}

Activator.prototype.deactivateDestination = function() {
   this.destActivated = false;
   this.emit(this.invert ? 'active' : 'inactive', this.name); 
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

   events.EventEmitter.call(this);

   var that = this;

   this.source.on('active', function (sourceName) {

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

               if (that.sourceActive) {
                  that.emit('active', that.source.name);
               }
            }, that.threshold*1000);
         }
      }
   });

   this.source.on('inactive', function (sourceName) {

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

               if (!that.sourceActive) {
                  that.emit('inactive', that.source.name);
               }
            }, that.threshold*1000);
         }
      }
   });
}

util.inherits(InputDebouncer, events.EventEmitter);

module.exports = exports = Activator;
