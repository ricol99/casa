var http = require('http');
var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function SecuritySpyCamera(_config) {
   this.casaSys = CasaSystem.mainInstance();
   Thing.call(this, _config);

   this.id = _config.id;

   this.ensurePropertyExists('continuous-capture', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('motion-capture', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('actions', 'property', { initialValue: false }, _config);

   this.securitySpyService =  this.casaSys.findService("securityspyservice");

   if (!this.securitySpyService) {
      console.error(this.uName + ": ***** Security Spy service not found! *************");
      process.exit();
   }

   if (_config.hasOwnProperty("triggerSource")) {
      _config.triggerSource.uName = (_config.triggerSource.hasOwnProperty("name")) ? _config.triggerSource.name : this.uName;
      this.triggerSource = new SourceListener(_config.triggerSource, this);
   }
}

util.inherits(SecuritySpyCamera, Thing);

SecuritySpyCamera.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': received property change, property='+ _data.sourceEventName + ' value=' + _data.value);

   var that = this;

   switch (_propName) {
      case "continuous-capture":
         this.securitySpyService.setContinuousCapture(this.id, _propValue, function(_err, _res) {

            if (_err) {
               console.error(that.uName + ": Not able to trigger motion event for camera " + that.id + "!");
            }
         });
         break;
      case "motion-capture":
         this.securitySpyService.setMotionCapture(this.id, _propValue, function(_err, _res) {

            if (_err) {
               console.error(that.uName + ": Not able to trigger motion event for camera " + that.id + "!");
            }
         });
         break;
      case "actions":
         this.securitySpyService.setActions(this.id, _propValue, function(_err, _res) {

            if (_err) {
               console.error(that.uName + ": Not able to trigger motion event for camera " + that.id + "!");
            }
         });
         break;
   }
}

//
// Called by SourceListener as a defined source has become valid again (available)
//
Property.prototype.sourceIsValid = function(_data) {
   this.valid = true;
}

//
// Called by SourceListener as a defined source has become invalid (unavailable)
//
Property.prototype.sourceIsInvalid = function(_data) {
   this.valid = false;
};

//
// Called by SourceListener as a defined source has changed it property value
//
Property.prototype.receivedEventFromSource = function(_data) {
   var that = this;

   if (this.valid) {

      if (this.triggerSource && this.triggerSource.sourceEventName === _data.sourceEventName) {

         this.securitySpyService.triggerMotionRecording(this.id, function(_err, _result) {

            if (_err) {
               console.error(that.uName + ": Not able to trigger motion event for camera " + that.id + "!");
            }
         });
      }
   }
};

module.exports = exports = SecuritySpyCamera;

