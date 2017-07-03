var util = require('util');
var Thing = require('./thing');
var SourceListener = require('./sourcelistener');

/************************
{
   "name": "scene:on-holiday",
   "displayName": "On Holiday Scene",
   "props": [
      {
         "name": "ACTIVE",
         "type": "scheduleproperty",
         "initialValue": false,
         "writable": false,
         "events": [
            {
               "rule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *",
               "propertyValue": true
            },
            {
               "rule": "4,9,14,19,24,29,34,39,44,49,54,59 * * * *",
               "propertyValue": false
            }
         ]
      }
   ],
   "sources": [
      {
         "name": "alarmtexecom:dumgoyne",
         "property": "target-state",
         "value": "armed-full"
      }
   ]
}
*************************/

function Scene(_config) {
   Thing.call(this, _config);

   this.sources = [];
   this.sourceListeners = {};
   this.sceneProp = _config.hasOwnProperty("sceneProp") ? _config.sceneProp : "ACTIVE";

   for (var i = 0; i < _config.sources.length; i++) {
      this.sources.push(_config.sources[i]);
      this.sources[i].ignoreSourceUpdates = true;

      if (!this.sourceListeners.hasOwnProperty(_config.sources[i].name)) {
         this.sourceListeners[_config.sources[i].name] = new SourceListener(this.sources[i], this);
      }
   }

}

util.inherits(Scene, Thing);

Scene.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {

   if ((_propertyName === this.sceneProp) && _propertyValue) {
      this.setSceneStates();
   }
};

Scene.prototype.setSceneStates = function() {

   for (var i = 0; i < this.sources.length; ++i) {
      var sourceListener = this.sourceListeners[this.sources[i].name];

      if (sourceListener.isValid()) {
         sourceListener.getSource().setProperty(this.sources[i].property, this.sources[i].value, { sourceName: this.uName });
      }
   }
};

Scene.prototype.sourceIsValid = function(_data) {
};

Scene.prototype.sourceIsInvalid = function(_data) {
};

module.exports = exports = Scene;
