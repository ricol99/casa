var assert = require('assert');
var BuildingConsoleApi = require('../consoleapis/buildingconsoleapi');
var McpService = require('../services/mcpservice');
var api = Object.create(BuildingConsoleApi.prototype);
var scene = { type: 'modeproperty', valid: true, cold: false, value: 'movie',
   config: { modeName: 'SCENE', restingMode: { name: 'none' }, modes: [{ name: 'movie', timeout: 120 }] },
   stateTimer: { left: function() { return 1500; } } };
var building = { getProperty: function(name) { return this.properties[name] && this.properties[name].value; }, getAllProperties: function(values) { Object.keys(this.properties).forEach(name => values[name] = this.properties[name].value); }, uName: ':building', properties: { SCENE: scene,
   'MOVIE-SCENE-ACTIVE': { value: true }, 'MOVIE-SCENE-DURATION': { valid: true, cold: false, value: -1 } } };
api.myObj = function() { return building; };
var roomScene = { valid: true, cold: false, value: 'movie' };
var room = { uName: ':room', buildingName: ':building', properties: { 'BUILDING-SCENE': roomScene,
   MODE: { valid: true, cold: false, value: 'manual' } }, controller: { uName: ':room:MODE', currentState: { name: 'manual' } } };
api.gang = { iterate: function(context, filter, visit) { visit(context, room); } };
var status = api.sceneStatus();
assert.strictEqual(status.selectedScene, 'movie');
assert.strictEqual(status.expiry.remainingSeconds, 2);
assert.strictEqual(status.rooms[0].mode, 'manual');
assert.strictEqual(status.rooms[0].sceneHasControl, false);
room.controller = roomScene;
assert.strictEqual(api.sceneStatus().rooms[0].sceneHasControl, true);
room.fromPeer = true;
assert.strictEqual(api.sceneStatus().rooms[0].sceneHasControl, null);
building.bowing = true; delete scene.stateTimer;
assert.strictEqual(api.sceneStatus().expiry.status, 'unknown');
assert.strictEqual(api.sceneProperty(), scene);
building.bowing = false; scene.cold = true;
assert.strictEqual(api.sceneStatus().selectedScene, null);
assert.strictEqual(api.sceneProperty(), scene);
scene.cold = false; scene.stateTimer = null;
assert.strictEqual(api.sceneStatus().expiry.status, 'indefinite');
scene.value = 'settle-invalid'; assert.strictEqual(api.sceneStatus().settling, true);
assert.strictEqual(api.sceneStatus().expiry.status, 'unknown');
scene.value = 'none'; assert.strictEqual(api.sceneStatus().expiry.status, 'inactive');
var service = Object.create(McpService.prototype);
var response = { status: function() { return this; }, json: function(body) { this.body = body; }, set: function() {} };
service.handleJsonRpc({ id: 1, method: 'tools/list' }, { headers: { 'mcp-protocol-version': '2025-06-18' } }, response);
var sceneTools = response.body.result.tools.filter(function(tool) { return ['casa.list_scenes', 'casa.get_scene_status', 'casa.set_scene', 'casa.release_scene'].includes(tool.name); });
assert.strictEqual(sceneTools.length, 4);
assert.deepStrictEqual(sceneTools.find(function(tool) { return tool.name === 'casa.set_scene'; }).inputSchema.required, ['uName', 'scene']);
console.log('[PASS] Scene status countdown, room control, unknown/peer/cold status, generic scene access and MCP discovery');
