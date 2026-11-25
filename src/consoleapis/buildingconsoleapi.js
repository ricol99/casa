var util = require('util');
var ThingConsoleApi = require('./thingconsoleapi');

function BuildingConsoleApi(config, owner) { ThingConsoleApi.call(this, config, owner); }
util.inherits(BuildingConsoleApi, ThingConsoleApi);

BuildingConsoleApi.prototype.sceneProperty = function(write) {
   var building = this.myObj();
   var scene = building.properties && building.properties.SCENE;
   if (!scene || scene.type !== 'modeproperty') throw new Error('Building does not expose a SCENE modeproperty');
   if (write && (building.fromPeer || building.bowing || !scene.valid || scene.cold)) {
      throw new Error('Scene writes require the valid owning building/Casa');
   }
   return scene;
};

BuildingConsoleApi.prototype.sceneStatus = function() {
   var building = this.myObj();
   var scene = this.sceneProperty(false);
   var valid = scene.valid === true && !scene.cold;
   var local = !building.fromPeer && !building.bowing;
   var modes = scene.config.modes || [];
   var selected = valid && modes.some(function(mode) { return mode.name === scene.value; }) ? scene.value : null;
   var result = { uName: building.uName, observedAt: new Date().toISOString(), valid: valid,
      state: valid ? scene.value : null, selectedScene: selected,
      settling: valid && scene.value === 'settle-invalid', timingAuthority: local ? 'local' : 'peer',
      expiry: { status: 'unknown', remainingSeconds: null, endsAt: null }, rooms: [] };
   if (valid && local && selected) {
      var timer = scene.stateTimer;
      var remaining = timer && timer.left();
      if (timer && remaining < 0 && timer.timeout) remaining = 0;
      if (timer && Number.isFinite(remaining) && remaining >= 0) {
         result.expiry = { status: 'timed', remainingSeconds: Math.ceil(remaining / 1000), endsAt: new Date(Date.now() + remaining).toISOString() };
      } else {
         var duration = building.properties[selected.toUpperCase() + '-' + (scene.config.modeName || 'MODE') + '-DURATION'];
         if (!timer && duration && duration.valid && !duration.cold && duration.value === -1) result.expiry.status = 'indefinite';
      }
   } else if (valid && scene.value === scene.config.restingMode.name) result.expiry.status = 'inactive';
   // Observe the existing named-object tree; room membership is not a separate registry.
   this.gang.iterate(null, null, function(context, object) {
      if (object.buildingName !== building.uName || !object.properties || !object.properties['BUILDING-SCENE']) return false;
      var roomScene = object.properties['BUILDING-SCENE'];
      var mode = object.properties.MODE;
      var authoritative = !object.fromPeer && !object.bowing;
      var roomValid = roomScene.valid === true && !roomScene.cold;
      result.rooms.push({ uName: object.uName, mode: mode && mode.valid && !mode.cold ? mode.value : null,
         scene: roomValid ? roomScene.value : null, timingAuthority: authoritative ? 'local' : 'peer',
         sceneHasControl: authoritative && roomValid ? object.controller === roomScene : null,
         controller: object.controller ? { uName: object.controller.uName,
            state: object.controller.currentState ? object.controller.currentState.name : null } : null });
      return false;
   });
   result.rooms.sort(function(a, b) { return a.uName.localeCompare(b.uName); });
   return result;
};

BuildingConsoleApi.prototype.getSceneStatus = function(session, params, callback) {
   callback(null, this.sceneStatus());
};

BuildingConsoleApi.prototype.listScenes = function(session, params, callback) {
   var scene = this.sceneProperty(false);
   callback(null, { scenes: (scene.config.modes || []).map(function(mode) {
      return { name: mode.name, defaultDurationSeconds: mode.hasOwnProperty('timeout') ? mode.timeout : -1 };
   }), sceneStatus: this.sceneStatus() });
};

BuildingConsoleApi.prototype.setScene = function(session, params, callback) {
   var scene = this.sceneProperty(true);
   var name = params && params[0];
   if (typeof name !== 'string' || !(scene.config.modes || []).some(function(mode) { return mode.name === name; })) {
      return callback('Unknown scene name; use listScenes');
   }
   // Use the same selector as a HomeKit scene button; never invoke manual mode.
   this.myObj().setProperty(name.toUpperCase() + '-' + (scene.config.modeName || 'MODE') + '-ACTIVE', true, { sourceName: 'scene-console' });
   this.observeScene(name, callback);
};

BuildingConsoleApi.prototype.releaseScene = function(session, params, callback) {
   var scene = this.sceneProperty(true);
   var building = this.myObj();
   (scene.config.modes || []).forEach(function(mode) {
      building.setProperty(mode.name.toUpperCase() + '-' + (scene.config.modeName || 'MODE') + '-ACTIVE', false, { sourceName: 'scene-console' });
   });
   this.observeScene(scene.config.restingMode.name, callback);
};

BuildingConsoleApi.prototype.observeScene = function(expected, callback) {
   var deadline = Date.now() + 1000;
   var observe = () => {
      var status = this.sceneStatus();
      var completed = status.valid && status.state === expected;
      if (!completed && Date.now() < deadline) return setTimeout(observe, 20);
      callback(null, { ok: true, completed: completed, sceneStatus: status });
   };
   observe();
};

module.exports = BuildingConsoleApi;
