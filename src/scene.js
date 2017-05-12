var util = require('util');
var Source = require('./source');
var SourceListener = require('./sourcelistener');

function Scene(_config) {
   this.uName = _config.name;
   this.displayName = _config.displayName;
   this.sceneStates = {};
   this.sourceListeners = {};
   this.noOfSources = 0;

   var configStateNames = { false: "inactiveState", true: "activeState" };

   for (var sceneState in configStateNames) {
      this.sceneStates[sceneState] = [];
      var sceneStateArray = _config.hasOwnProperty(configStateNames[sceneState]) ? [ _config[configStateNames[sceneState]] ] : _config[configStateNames[sceneState]+"s"];

      if (sceneStateArray) {

         for (var i = 0; i < sceneStateArray.length; i++) {
            this.sceneStates[sceneState].push({ uName: sceneStateArray[i].name, property: sceneStateArray[i].property, value: sceneStateArray[i].value, ignoreSourceUpdates: true });

            if (!this.sourceListeners.hasOwnProperty(sceneStateArray[i].name)) {
               this.sourceListeners[sceneStateArray[i].name] = new SourceListener(this.sceneStates[sceneState][i], this);
               this.noOfSources++;
            }
         }
      }
   }

   Source.call(this, _config);
}

util.inherits(Scene, Source);

Scene.prototype.propertyAboutToChange = function(_propertyName, _propertyValue, _data) {

   if (_propertyName === "ACTIVE") {
      this.setSceneStates(_propertyValue);
   }
};

Scene.prototype.setSceneStates = function(_sceneState) {

   for (var i = 0; i < this.sceneStates[_sceneState].length; ++i) {
      var sourceListener = this.sourceListeners[this.sceneStates[_sceneState][i].uName];

      if (sourceListener.isValid()) {
         sourceListener.getSource().setProperty(this.sceneStates[_sceneState][i].property, this.sceneStates[_sceneState][i].value, { sourceName: this.uName });
      }
   }
};

Scene.prototype.sourceIsValid = function(_data) {
};

Scene.prototype.sourceIsInvalid = function(_data) {
};

module.exports = exports = Scene;
