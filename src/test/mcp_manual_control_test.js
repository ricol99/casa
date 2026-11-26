var assert = require('assert');
var McpService = require('../services/mcpservice');
var SourceConsoleApi = require('../consoleapis/sourceconsoleapi');

(async function() {
   var service = Object.create(McpService.prototype);
   var resets = 0;
   var mode = { type: 'modeproperty', value: 'auto', valid: true, cold: false,
      config: { restingMode: { name: 'auto' } }, currentState: { name: 'auto' },
      resetStateTimer: function() {
         resets++;
         var end = Date.now() + target.getProperty('MANUAL-MODE-DURATION') * 1000;
         this.stateTimer = { left: function() { return end - Date.now(); } };
         target.properties['MODE-EXPIRES-AT'].value = end;
      }
   };
   var target = { uName: ':room', name: 'room', properties: {
      MODE: mode, 'MODE-EXPIRES-AT': { value: -1, valid: true }, 'MODE-RESTING-STATE': { value: 'auto', valid: true }, 'MANUAL-MODE-DURATION': { value: -1, valid: true },
      'MANUAL-MODE-ACTIVE': { value: false }, 'HOLIDAY-MODE-ACTIVE': { value: true }
   }, getProperty: function(name) { return this.properties[name].value; },
      setProperty: function(name, value, data) {
         var changed = this.properties[name].value !== value;
         this.properties[name].value = value;
         if (!changed && !data.forceUpdate) return;
         setTimeout(function() {
            if (name === 'MANUAL-MODE-DURATION' && value > 0 || name === 'MANUAL-MODE-ACTIVE' && value === true) {
               mode.value = 'manual'; mode.currentState = { name: 'manual' };
               target.properties['MANUAL-MODE-ACTIVE'].value = true;
               if (target.getProperty('MANUAL-MODE-DURATION') > 0) mode.resetStateTimer();
            }
            else {
               mode.value = 'auto'; mode.currentState = { name: 'auto' }; mode.stateTimer = null; target.properties['MODE-EXPIRES-AT'].value = -1;
               target.properties['MANUAL-MODE-ACTIVE'].value = false;
            }
         }, 5);
      }
   };
   var api = Object.create(SourceConsoleApi.prototype);
   api.myObj = function() { return target; };
   service.gang = { casa: { findService: function() { return { findOrCreateConsoleApiObject: function(object) {
      assert.strictEqual(object, target); return api;
   } }; } }, findNamedObject: function(name) { return name === ':room' ? target : null; } };
   function call(name, args) {
      return new Promise(function(resolve) {
         service.handleToolCall(1, { name: 'casa.' + name, arguments: args }, {
            status: function() { return this; }, json: resolve
         });
      });
   }
   var result = await call('set_mode_manual', { uName: ':room', duration: 30 });
   assert.strictEqual(result.result.structuredContent.completed, true);
   assert.strictEqual(result.result.structuredContent.controlStatus.mode, 'manual');
   result = await call('renew_manual_override', { uName: ':room', duration: 60 });
   assert.strictEqual(result.result.structuredContent.controlStatus.manualOverride.remainingSeconds, 60);
   var before = resets;
   result = await call('renew_manual_override', { uName: ':room', duration: 60 });
   assert.strictEqual(result.result.structuredContent.completed, true);
   assert.strictEqual(resets, before + 1, 'unchanged duration must restart timer');
   result = await call('release_manual_override', { uName: ':room' });
   assert.strictEqual(result.result.structuredContent.controlStatus.mode, 'auto');
   assert.strictEqual(target.getProperty('HOLIDAY-MODE-ACTIVE'), true, 'release must not clear other modes');
   result = await call('release_manual_override', { uName: ':room' });
   assert.strictEqual(result.result.structuredContent.completed, true);
   result = await call('renew_manual_override', { uName: ':room', duration: 30 });
   assert.strictEqual(result.error.code, -32000);
   for (var duration of [0, -1, '30', Infinity, NaN]) {
      result = await call('renew_manual_override', { uName: ':room', duration: duration });
      assert.strictEqual(result.error.code, -32602);
   }
   result = await call('renew_manual_override', { uName: ':room' });
   assert.strictEqual(result.error.code, -32602);
   target.fromPeer = true;
   mode.type = 'property';
   api = Object.create(require('../consoleapis/peersourceconsoleapi').prototype);
   api.myObj = function() { return target; };
   result = await call('set_mode_manual', { uName: ':room', duration: 30 });
   assert.strictEqual(result.result.structuredContent.completed, true);
   before = resets;
   result = await call('renew_manual_override', { uName: ':room', duration: 30 });
   assert.strictEqual(resets, before + 1);
   assert.strictEqual(result.result.structuredContent.completed, true, 'mirrored expiry verifies renewal');
   assert.strictEqual(result.result.structuredContent.controlStatus.manualOverride.status, 'timed');
   result = await call('release_manual_override', { uName: ':room' });
   assert.strictEqual(result.result.structuredContent.completed, true);
   var originalWrite = target.setProperty;
   target.setProperty = function() { return false; };
   result = await call('set_mode_manual', { uName: ':room', duration: 30 });
   assert.strictEqual(result.error.code, -32000);
   result = await call('release_manual_override', { uName: ':room' });
   assert.strictEqual(result.error.code, -32000);
   mode.value = 'manual';
   result = await call('renew_manual_override', { uName: ':room', duration: 30 });
   assert.strictEqual(result.error.code, -32000);
   target.setProperty = originalWrite;
   process.stdout.write('[PASS] MCP manual set/release/renew, unchanged renewal, async status and validation\n');
})().catch(function(error) { console.error(error); process.exitCode = 1; });
