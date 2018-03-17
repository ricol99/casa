var util = require('util');
var Thing = require('../thing');
var CasaSystem = require('../casasystem');

function HueLightGroup(_config) {
   Thing.call(this, _config);
   this.thingType = "hue-light-group";

   if (_config.hassOwnProperty('lightGroupId') {
      this.lightGroupId = _config.lightGroupId;
   }
   else if (_config.hasOwnproperty('hueGroupName') {
      this.hueGroupName = _config.hueGroupName;
   }

   this.hueService =  this.casaSys.findService("hueservice");

   if (!this.hueService) {
      console.error(this.uName + ": ***** Hue service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('scene', 'property', { initialValue: false }, _config);
}

util.inherits(HueLightGroup, Thing);

HueLightGroup.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (!_data.coldStart) {

      if ((_propName == "scene") && (_propValue != "CLEARED")) {

         this.hueService.setScene(_propValue, (_error, _content) => {

            if (_error) {
               console.log(this.uName + ': Error activating scene: ', _error);
            }
         });

         this.alignPropertyValue(_propName, "CLEARED");
      }
      else if (_propName == "power") {

         this.hueService.setLightGroupState(this.lightGroupId, { power: _propValue }, (_error, _content) => {

            if (_error) {
               console.log(this.uName + ': Error setting light group power: ' + _error.message);
            }
         });
      }
   }
};

HueLightGroup.prototype.coldStart = function() {

   if (this.hueGroupName) {

      hue.groups( (_err, _result) => {

         if (_err) {
            console.error(this.uName + ": Unable to find room on Hue Bridge!");
         }
         else {
            for (var i = 0; i < _result.length; ++i) {
               var check = (this.groupType) ? (_result[i].type === this.groupType) : true;

               if (check && (_result[i].name == this.hueGroupName)) {
                  this.lightGroupId = _result[i].id;
                  break;
               }
            }

            if (!this.hasOwnProperty('lightGroupId')) {
               console.error(this.uName + ": Unable to find room on Hue Bridge!");
            }

            Thing.prototype.coldStart.call(this);
         }
      });
   }
};


module.exports = exports = HueLightGroup;
