var util = require('../util');
var Property = require('../property');

function LatchProperty(_config, _owner) {
   this.minOutputTime = _config.minOutputTime;
   Property.call(this, _config, _owner);

   this.minOutputTimeObj = null;
   this.sourceActive = false;
   this.active = false;
   this.lastData = null;
}

util.inherits(LatchProperty, Property);

// Called when system state is required
LatchProperty.prototype.export = function(_exportObj) {
   Property.prototype.export.call(this, _exportObj);
   _exportObj.minOutputTimeObj = this.minOutputTimeObj ? this.minOutputTimeObj.left() : -1;
   _exportObj.sourceActive = this.sourceActive;
   _exportObj.active = this.active;
   _exportObj.lastData = util.copy(this.lastData);
};

// Called to restore system state before hot start
LatchProperty.prototype.import = function(_importObj) {
   Property.prototype.import.call(this, _importObj);
   this.sourceActive = _importObj.sourceActive;
   this.active = _importObj.active;
   this.lastData = util.copy(_importObj.this.lastData);
   this.minOutputTimeObj = _importObj.minOutputTimeObj;
};

// Called after system state has been restored
LatchProperty.prototype.hotStart = function() {
   Property.prototype.hotStart.call(this);

   if (this.minOutputTimeObj !== -1) {
      this.restartTimer(this.minOutputTimeObj);
   }
   else {
      this.minOutputTimeObj = null;
   }
};

// Called to start a cold system
LatchProperty.prototype.coldStart = function () {
   Property.prototype.coldStart.call(this);
};


LatchProperty.prototype.newEventReceivedFromSource = function(_sourceListener, _data) {
   var propValue = _data.value;
   this.lastData = _data;

   if (propValue) {
      console.log(this.uName + ': target ' + _data.sourceName + ' active!');
      this.sourceActive = true;
   
      if (this.minOutputTime != undefined) {
         this.restartTimer();
         this.active = true;
         this.updatePropertyInternal(propValue, _data);
         return;
      }
   }
   else {
      console.log(this.uName + ': target ' + _data.sourceName + ' inactive!');
      this.sourceActive = false;

      if (this.active) {

         if (this.minOutputTime != undefined) {

            // Destination is active. If there is no timer, deactivate. Else, let the timer do it
            if (this.minOutputTimeObj == null) {
               this.active = false;
               this.updatePropertyInternal(false, _data);
               return;
            }
         }
      }
      else {
         this.active = false;
         this.updatePropertyInternal(false, _data);
         return;
      }
   }
}

// ====================
// NON_EXPORTED METHODS
// ====================

LatchProperty.prototype.restartTimer = function(_overrideTimeout) {
   var timeout = _overrideTimeout ? _overrideTimeout : this.minOutputTime*1000;

   if (!_overrideTimeout && this.minOutputTimeObj) {
      util.clearTimeout(this.minOutputTimeObj);
   }

   this.minOutputTimeObj = util.setTimeout(function(_this) {
      _this.minOutputTimeObj = null;

      if (!_this.sourceActive) {
         _this.active = false;

         if (_this.lastData) {
            _this.updatePropertyInternal(false, _this.lastData);
            _this.lastData = null;
            return;
         }
      }
   }, timeout, this);
}

module.exports = exports = LatchProperty;
