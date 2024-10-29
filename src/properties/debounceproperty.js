var util = require('../util');
var Property = require('../property');

function Debounce2Property(_config, _owner) {
   this.threshold = _config.threshold;
   this.ignoreUnderThreshold = _config.hasOwnProperty("ignoreUnderThreshold") ? _config.ignoreUnderThreshold : false;
   this.invalidValue = _config.invalidValue;
   this.timeoutObj = null;
   this.sourceValid = false;

   Property.call(this, _config, _owner);

   if (this.ignoreUnderThreshold) {
      this.createProperty({ name: _config.name + "-model", type: "stateproperty", initialValue: "not-set", ignoreControl: true, 
                            states: [ { name: "not-set", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: true, nextState: "not-set-holding" },
                                                      action: { property: this.name, value: false }},
                                      { name: "not-set-holding", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: false, nextState: "not-set" },
                                                                timeout: { "duration": _config.threshold, nextState: "set" }},
                                      { name: "set", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: false, nextState: "set-holding" },
                                                     action: { property: this.name, value: true }},
                                      { name: "set-holding", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: true, nextState: "set" },
                                                             timeout: { "duration": _config.threshold, nextState: "not-set" }} ] }, _config);
   }
   else {
      this.createProperty({ name: _config.name + "-model", type: "stateproperty", initialValue: "not-set", ignoreControl: true,
                            states: [ { name: "not-set", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: true, nextState: "set-holding" }},
                                      { name: "set-holding", action: { property: this.name, value: true }, timeout: { "duration": _config.threshold, nextState: "set" }},
                                      { name: "set", source: { uName: _config.sources[0].uName, property: _config.sources[0].property, value: false, nextState: "not-set-holding" }},
                                      { name: "not-set-holding", action: { property: this.name, value: false}, timeout: { "duration": _config.threshold, nextState: "not-set" }} ] }, _config);
   }
}

util.inherits(Debounce2Property, Property);

// Called when system state is required
Debounce2Property.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
   _exportObj.timeoutObj = this.timeoutObj ? this.timeoutObj.left() : -1;
};

// Called to restore system state before hot start
Debounce2Property.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
   this.timeoutObj = _importObj.timeoutObj;
};

// Called after system state has been restored
Debounce2Property.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);

   if (this.timeoutObj !== -1) {
      this.startTimer(this.timeoutObj);
   }
   else {
      this.startTimer = null;
   }
};

// Called to start a cold system
Debounce2Property.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};

Debounce2Property.prototype.startTimer = function(_timeout) {
   var timeout = _timeout ? _timeout : this.threshold*1000;

   this.timeoutObj = util.setTimeout( () => {
      console.log(this.uName + ": Timer expired!");
      this.timeoutObj = null;

      if (!this.sourceValid) {

         if (this.invalidValue != undefined) {
            this.updatePropertyInternal(this.invalidValue);
         }

         Property.prototype.sourceIsInvalid.call(this, this.invalidData);
      }

   }, timeout);
}

Debounce2Property.prototype.sourceIsInvalid = function(_data) {
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
};

Debounce2Property.prototype.sourceIsValid = function(_data) {
   this.sourceValid = true;
   this.invalidData = null;
   Property.prototype.sourceIsValid.call(this, _data);
};

Debounce2Property.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
};

module.exports = exports = Debounce2Property;
