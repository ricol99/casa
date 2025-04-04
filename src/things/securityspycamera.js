var http = require('http');
var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function SecuritySpyCamera(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.id = _config.id;

   this.ensurePropertyExists('continuous-capture', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('motion-capture', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('actions', 'property', { initialValue: false }, _config);

   this.service = (_config.hasOwnProperty("service")) ? _config.service :  "securityspyservice";
   this.securitySpyService =  this.casa.findService(this.service);

   if (!this.securitySpyService) {
      console.error(this.uName + ": ***** Security Spy service not found! *************");
      process.exit();
   }

   if (_config.hasOwnProperty("triggerSource")) {
      _config.triggerSource.uName = (_config.triggerSource.hasOwnProperty("uName")) ? _config.triggerSource.uName : this.uName;
      _config.triggerSource.listeningSource = this.uName;
      this.triggerSource = new SourceListener(_config.triggerSource, this);
   }

   this.securitySpyService.registerCamera(this.id, this);
}

util.inherits(SecuritySpyCamera, Thing);

// Called when current state required
SecuritySpyCamera.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
SecuritySpyCamera.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

SecuritySpyCamera.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

SecuritySpyCamera.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

SecuritySpyCamera.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {
   console.log(this.uName + ': received property change, property='+ _data.sourceEventName + ' value=' + _data.value);

   switch (_propName) {
      case "continuous-capture":
         this.securitySpyService.setContinuousCapture(this.id, _propValue, (_err, _res) => {

            if (_err) {
               console.error(this.uName + ": Not able to trigger motion event for camera " + this.id + "!");
            }
         });
         break;
      case "motion-capture":
         this.securitySpyService.setMotionCapture(this.id, _propValue, (_err, _res) => {

            if (_err) {
               console.error(this.uName + ": Not able to trigger motion event for camera " + this.id + "!");
            }
         });
         break;
      case "actions":
         this.securitySpyService.setActions(this.id, _propValue, (_err, _res) => {

            if (_err) {
               console.error(this.uName + ": Not able to trigger motion event for camera " + this.id + "!");
            }
         });
         break;
   }
}

//
// Called by SourceListener as a defined source has become valid again (available)
//
SecuritySpyCamera.prototype.sourceIsValid = function(_data) {
   this.valid = true;
}

//
// Called by SourceListener as a defined source has become invalid (unavailable)
//
SecuritySpyCamera.prototype.sourceIsInvalid = function(_data) {
   this.valid = false;
};

//
// Called by SourceListener as a defined source has changed it property value
//
SecuritySpyCamera.prototype.receivedEventFromSource = function(_data) {

   if (this.valid) {

      if (this.triggerSource && this.triggerSource.sourceEventName === _data.sourceEventName) {

         this.securitySpyService.triggerMotionRecording(this.id, (_err, _result) => {

            if (_err) {
               console.error(this.uName + ": Not able to trigger motion event for camera " + this.id + "!");
            }
         });
      }
   }
};

module.exports = exports = SecuritySpyCamera;

