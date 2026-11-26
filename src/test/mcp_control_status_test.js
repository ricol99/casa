var assert = require('assert');
var McpService = require('../services/mcpservice');
var service = Object.create(McpService.prototype);
var now = 1800000000000;
var originalNow = Date.now;
Date.now = function() { return now; };
try {
   var mode = { type: 'modeproperty', value: 'manual', valid: true, cold: false,
      currentState: { name: 'manual' }, config: { restingMode: { name: 'auto' } },
      stateTimer: { left: function() { return 120000; } } };
   var target = { uName: ':room', name: 'room', displayName: 'Living room',
      properties: { MODE: mode, 'MODE-EXPIRES-AT': { value: now + 120000, valid: true }, 'MODE-RESTING-STATE': { value: 'auto', valid: true }, 'MANUAL-MODE-DURATION': { value: 300, valid: true, cold: false } } };
   target.getProperty = function(name) { return this.properties[name].value; };
   service.gang = { findNamedObject: function(name) { return name === ':room' ? target : null; } };
   var response = { status: function() { return this; }, set: function() {}, json: function(body) { this.body = body; } };
   service.handleJsonRpc({ id: 1, method: 'tools/list' }, { headers: { 'mcp-protocol-version': '2025-06-18' } }, response);
   var tool = response.body.result.tools.find(function(item) { return item.name === 'casa.get_control_status'; });
   assert.strictEqual(tool.annotations.readOnlyHint, true);
   assert.deepStrictEqual(tool.inputSchema.required, ['uName']);

   service.handleToolCall(2, { name: tool.name, arguments: { uName: ':room' } }, response);
   var status = response.body.result.structuredContent;
   assert.deepStrictEqual(JSON.parse(response.body.result.content[0].text), status);
   assert.strictEqual(status.manualOverride.remainingSeconds, 120, 'use live remaining time, not configured 300 seconds');
   assert.strictEqual(status.manualOverride.endsAt, new Date(now + 120000).toISOString());
   assert.strictEqual(status.returnToAuto.status, 'expected');
   assert.strictEqual(status.mode, 'manual');
   now += 1000;
   mode.stateTimer.left = function() { return 119000; };
   assert.strictEqual(service.getControlStatus(target).manualOverride.remainingSeconds, 119);
   target.properties['MODE-EXPIRES-AT'].value = now - 1;
   assert.strictEqual(service.getControlStatus(target).manualOverride.remainingSeconds, 0);
   target.properties['MODE-EXPIRES-AT'].value = -1;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown');
   target.properties['MANUAL-MODE-DURATION'].value = -1;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'indefinite');
   assert.strictEqual(service.getControlStatus(target).returnToAuto.status, 'not_scheduled');
   target.fromPeer = true;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'indefinite');
   target.fromPeer = false;
   target.bowing = true;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'indefinite');
   target.bowing = false;
   mode.type = 'property';
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'indefinite', 'generic expiry works with inherited MODE');
   mode.type = 'modeproperty';
   mode.value = 'auto';
   assert.strictEqual(service.getControlStatus(target).returnToAuto.status, 'already_auto');
   mode.value = 'holiday';
   assert.strictEqual(service.getControlStatus(target).returnToAuto.status, 'unknown');
   mode.value = 'manual'; mode.valid = false;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown');
   mode.valid = true; mode.cold = true;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown');
   mode.cold = false; mode.config.restingMode.name = 'idle';
   target.properties['MODE-EXPIRES-AT'].value = now + 5000;
   target.properties['MODE-RESTING-STATE'].value = 'idle';
   assert.strictEqual(service.getControlStatus(target).returnToAuto.status, 'unknown');
   target.fromPeer = true;
   mode.type = 'property';
   target.properties['MODE-RESTING-STATE'].value = 'auto';
   assert.strictEqual(service.getControlStatus(target).returnToAuto.status, 'expected');
   target.properties['MODE-EXPIRES-AT'].cold = true;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown');
   target.properties['MODE-EXPIRES-AT'].cold = false;
   target.properties['MODE-EXPIRES-AT'].valid = false;
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown');
   delete target.properties['MODE-EXPIRES-AT'];
   assert.strictEqual(service.getControlStatus(target).manualOverride.status, 'unknown', 'older peers have no expiry metadata');
   target.controller = { uName: ':room:lighting', currentState: { name: 'occupied' } };
   assert.deepStrictEqual(service.getControlStatus(target).controller, { uName: ':room:lighting', state: 'occupied' });

   [undefined, {}, { uName: 12 }, { uName: '' }].forEach(function(args) {
      service.handleToolCall(3, { name: tool.name, arguments: args }, response);
      assert.strictEqual(response.body.error.code, -32602);
   });
   service.handleToolCall(4, { name: tool.name, arguments: { uName: ':missing' } }, response);
   assert.strictEqual(response.body.error.message, 'Object not found');
   delete target.properties.MODE;
   service.handleToolCall(5, { name: tool.name, arguments: { uName: ':room' } }, response);
   assert.strictEqual(response.body.error.message, 'Target does not expose MODE');
   process.stdout.write('[PASS] MCP control status: tool dispatch, live countdown, auto/indefinite/unknown modes and errors\n');
} finally {
   Date.now = originalNow;
}
