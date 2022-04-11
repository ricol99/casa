var util = require('../util');
var Property = require('../property');

function DebounceProperty(_config, _owner) {

   this.threshold = _config.threshold;
   this.invalidValue = _config.invalidValue;
   this.timeoutObj = null;
   this.sourceState = false;
   this.outputState = false;
   this.sourceValid = false;

   Property.call(this, _config, _owner);
}

util.inherits(DebounceProperty, Property);

// Called when system state is required
DebounceProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj)) {
   _exportObj.sourceState = this.sourceState;
   _exportObj.outputState = this.outputState;
   _exportObj.timeoutObj = this.timeoutObj ? this.timeoutObj.left() : -1;
};

// Called to restore system state before hot start
DebounceProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj)) {
   this.sourceState = _importObj.sourceState;
   this.outputState = _importObj.outputState;
   this.timeoutObj = _importObj.timeoutObj;
};

// Called after system state has been restored
DebounceProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);

   if (this.timeoutObj !== -1) {
      this.startTimer(this.timeoutObj);
   }
};

DebounceProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.value;
   console.log(this.uName + ':source ' + _data.sourceName + ' property ' + _data.name + ' has changed to ' + propValue + '!');

   if (_data.coldStart) {    // Cold start only once
      this.sourceState = propValue;
      this.outputState = propValue;
      this.updatePropertyInternal(propValue, _data);
      return;
   }

   if (this.outputState == propValue) {   // Current output is the same as new input, just update input
      this.sourceState = propValue;
   }
   else if (this.sourceState != propValue) {   // Input has changed, start timer and ignore until timer expires
      this.sourceState = propValue;
      this.lastData = util.copy(_data);  // TODO: Should we cache positive and negative case?

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {
         this.startTimer();
      }
   }
};


//DebounceProperty.prototype.goInvalid = function(_data) {

  //if (this.readyToGoInvalid) {
     //this.readyToGoInvalid = false;
     //Property.prototype.goInvalid.call(this, _data);
  //}
//};

DebounceProperty.prototype.sourceIsInvalid = function(_data) {
   console.log(this.uName + ': Source ' + _data.sourceName + ' property ' + _data.name + ' invalid!');
   this.invalidData = util.copy(_data);

   if (this.valid) {
      this.sourceValid = false;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {
         console.log(this.uName + ": Starting timer....");
         this.startTimer();
      }
   }

   //Property.prototype.sourceIsInvalid.call(this, _data);
};

DebounceProperty.prototype.sourceIsValid = function(_data) {
   this.sourceValid = true;
   this.sourceState = false;
   this.outputState = false;
   this.lastData = null;
   Property.prototype.sourceIsValid.call(this, _data);
};

// ====================
// NON-EXPORTED METHODS
// ====================

DebounceProperty.prototype.startTimer = function(_timeout) {
   var timeout = _timeout ? _timeout : this.threshold*1000;

   this.timeoutObj = util.setTimeout( () => {
      console.log(this.uName + ": Timer expired!");
      this.timeoutObj = null;

      if (this.lastData) {
         this.outputState = this.sourceState;
         this.updatePropertyInternal(this.sourceState, this.lastData);
         this.lastData = null;
      }

      if (!this.sourceValid) {

         if (this.invalidValue != undefined) {
            this.updatePropertyInternal(this.invalidValue);
         }

         Property.prototype.sourceIsInvalid.call(this, this.invalidData);
      }
   }, timeout);
}

module.exports = exports = DebounceProperty;
