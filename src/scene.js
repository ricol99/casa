var util = require('util');
var Thing = require('./thing');
var SourceListener = require('./sourcelistener');

/************************
{
   "name": "scene:on-holiday",
   "displayName": "On Holiday Scene",
   "properties": [
      {
         "name": "ACTIVE",
         "type": "scheduleproperty",
         "initialValue": false,
         "writable": false,
         "events": [
            {
               "rule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *",
               "value": true
            },
            {
               "rule": "4,9,14,19,24,29,34,39,44,49,54,59 * * * *",
               "value": false
            }
         ]
      }
   ],
   "sources": [
      {
         "name": "::dumgoyne",
         "property": "target-state",
         "value": "armed-full"
      }
   ]
}
*************************/

function Scene(_config, _owner) {
   Thing.call(this, _config, _owner);

   this.sources = [];
   this.sourceListeners = {};
   this.sceneProp = (_config.hasOwnProperty("sceneProp")) ? _config.sceneProp : "ACTIVE";

   for (var i = 0; i < _config.sources.length; i++) {

      if (!(_config.sources[i].hasOwnProperty("uName"))) {
         _config.sources[i].uName = this.uName;
      }

      _config.sources[i].listeningSource = this.uName;
      this.sources.push(_config.sources[i]);
      var sourceListenerName = _config.sources[i].uName + ":" + _config.sources[i].property;
      this.sources[this.sources.length-1].sourceListenerName = sourceListenerName;

      if (!this.sourceListeners.hasOwnProperty(sourceListenerName)) {
         this.sourceListeners[sourceListenerName] = new SourceListener(this.sources[i], this);
      }
   }

}

util.inherits(Scene, Thing);

// Used to classify the type and understand where to load the javascript module
Scene.prototype.superType = function(_type) {
   return "scene";
};

// Called when current state required
Scene.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
Scene.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

Scene.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);
};

Scene.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

Scene.prototype.receivedEventFromSource = function(_data) {
   var changed = false;

   for (var i = 0; i < this.sources.length; i++) {

      if ((this.sources[i].uName === _data.sourceName) &&
          (this.sources[i].property === _data.name) &&
          (this.sources[i].currentValue !== _data.value)) {

         this.sources[i].currentValue = _data.value;
         changed = true;
         break;
      }
   }

   if (changed) {
      var active = true;

      for (var j = 0; j < this.sources.length; j++) {

         if (this.sources[j].currentValue !== this.sources[j].value) {
            active = false;
            break;
         }
      }

      this.alignPropertyValue(this.sceneProp, active);
   }
};

Scene.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {

   if ((_propertyName === this.sceneProp) && _propertyValue) {
      this.setSceneStates();
   }
};

Scene.prototype.setSceneStates = function() {

   for (var i = 0; i < this.sources.length; ++i) {
      var sourceListener = this.sourceListeners[this.sources[i].sourceListenerName];
      this.sources[i].currentValue = this.sources[i].value;

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
