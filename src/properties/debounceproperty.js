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

DebounceProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.value;
   console.log(this.fullName + ':source ' + _data.sourceName + ' property ' + _data.name + ' has changed to ' + propValue + '!');

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
   console.log(this.fullName + ': Source ' + _data.sourceName + ' property ' + _data.name + ' invalid!');
   this.invalidData = util.copy(_data);

   if (this.valid) {
      this.sourceValid = false;

      // If a timer is already running, ignore. ELSE create one
      if (this.timeoutObj == null) {
         console.log(this.fullName + ": Starting timer....");
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

DebounceProperty.prototype.startTimer = function() {

   this.timeoutObj = setTimeout(function(_this) {
      console.log(_this.fullName + ": Timer expired!");
      _this.timeoutObj = null;

      if (_this.lastData) {
         _this.outputState = _this.sourceState;
         _this.updatePropertyInternal(_this.sourceState, _this.lastData);
         _this.lastData = null;
      }

      if (!_this.sourceValid) {

         if (_this.invalidValue != undefined) {
            _this.updatePropertyInternal(_this.invalidValue);
         }

         Property.prototype.sourceIsInvalid.call(_this, _this.invalidData);
         //_this.readyToGoInvalid = true;
         //_this.goInvalid(_this.invalidData);
      }
   }, this.threshold*1000, this);
}

module.exports = exports = DebounceProperty;
