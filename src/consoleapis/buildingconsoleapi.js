var util = require('util');
var ThingConsoleApi = require('./thingconsoleapi');

function BuildingConsoleApi(config, owner) { ThingConsoleApi.call(this, config, owner); }
util.inherits(BuildingConsoleApi, ThingConsoleApi);

// Scene selectors are public properties on both buildings and their peer mirrors.
BuildingConsoleApi.prototype.sceneProperty = function() {
   return this.myObj().properties.SCENE;
};

BuildingConsoleApi.prototype.sceneNames = function() {
   var values = {};
   this.myObj().getAllProperties(values);
   return Object.keys(values).filter(function(name) {
      return name.endsWith('-SCENE-ACTIVE');
   }).map(function(name) { return name.slice(0, -13).toLowerCase(); });
};

BuildingConsoleApi.prototype.sceneStatus = function() {
   var building = this.myObj();
   var scene = this.sceneProperty();
   var valid = !!scene && scene.valid === true && !scene.cold;
   var local = !!scene && Object.prototype.hasOwnProperty.call(scene, 'stateTimer');
   var state = building.getProperty('SCENE');
   var selected = valid && this.sceneNames().includes(state) ? state : null;
   var result = { uName: building.uName, observedAt: new Date().toISOString(), valid: valid,
      state: valid ? state : null, selectedScene: selected,
      settling: valid && state === 'settle-invalid', timingAuthority: local ? 'local' : 'peer',
      expiry: { status: 'unknown', remainingSeconds: null, endsAt: null }, rooms: [] };
   if (valid && local && selected) {
      var timer = scene.stateTimer;
      var remaining = timer && timer.left();
      if (timer && remaining < 0 && timer.timeout) remaining = 0;
      if (timer && Number.isFinite(remaining) && remaining >= 0) {
         result.expiry = { status: 'timed', remainingSeconds: Math.ceil(remaining / 1000), endsAt: new Date(Date.now() + remaining).toISOString() };
      } else {
         var duration = building.properties[selected.toUpperCase() + '-SCENE-DURATION'];
         if (!timer && duration && duration.valid && !duration.cold && duration.value === -1) result.expiry.status = 'indefinite';
      }
   } else if (valid && state === 'none') result.expiry.status = 'inactive';
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
   var building = this.myObj();
   var scene = this.sceneProperty();
   var modes = scene && scene.config && scene.config.modes || [];
   callback(null, { scenes: this.sceneNames().map(function(name) {
      var mode = modes.find(function(mode) { return mode.name === name; });
      return { name: name, durationSeconds: building.getProperty(name.toUpperCase() + '-SCENE-DURATION'),
         defaultDurationSeconds: mode ? (mode.hasOwnProperty('timeout') ? mode.timeout : -1) : null };
   }), sceneStatus: this.sceneStatus() });
};

BuildingConsoleApi.prototype.setScene = function(session, params, callback) {
   var name = params && params[0];
   if (typeof name === 'string') name = name.toLowerCase();
   if (typeof name !== 'string' || !this.sceneNames().includes(name)) {
      return callback('Unknown scene name; use listScenes');
   }
   // Use the same selector as a HomeKit scene button; never invoke manual mode.
   this.myObj().setProperty(name.toUpperCase() + '-SCENE-ACTIVE', true, { sourceName: 'scene-console' });
   this.observeScene(name, callback);
};

BuildingConsoleApi.prototype.releaseScene = function(session, params, callback) {
   var building = this.myObj();
   this.sceneNames().forEach(function(name) {
      building.setProperty(name.toUpperCase() + '-SCENE-ACTIVE', false, { sourceName: 'scene-console' });
   });
   this.observeScene('none', callback);
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
