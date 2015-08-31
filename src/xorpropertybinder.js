var util = require('util');
var SourceMergePropertyBinder = require('./sourcemergepropertybinder');

function XorPropertyBinder(_config, _owner) {

   _config.allInputsRequiredForValidity = false;
   SourceMergePropertyBinder.call(this, _config, _owner);

   var that = this;
}

util.inherits(XorPropertyBinder, SourceMergePropertyBinder);

XorPropertyBinder.prototype.checkActivate = function() {
   var allInputsActive = true;
   var oneInputActive = false;

   // any input active, but not all of them
   for (var prop in this.multiSourceListener.sourceAttributes) {

      if (this.multiSourceListener.sourceAttributes.hasOwnProperty(prop) && this.multiSourceListener.sourceAttributes[prop] && this.multiSourceListener.sourceAttributes[prop].active) {
         oneInputActive = true;
      }
      else {
         allInputsActive = false;
      }
   }

   return (allInputsActive) ? false : oneInputActive;
};

module.exports = exports = XorPropertyBinder;
