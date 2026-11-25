var assert = require('assert');
var fs = require('fs');
var vm = require('vm');
var util = require('../util');
var State = require('../state');

// Capture generated configurations, then pass the resting state through the real
// State constructor so singular-field normalisation cannot hide lost entries.
function CapturedStateProperty(config) { this.config = config; }
CapturedStateProperty.prototype.createProperty = function() {};
var sandbox = { module: { exports: {} }, require: function(name) {
   return name === '../util' ? util : CapturedStateProperty;
} };
vm.runInNewContext(fs.readFileSync(require.resolve('../properties/modeproperty'), 'utf8'), sandbox);
var ModeProperty = sandbox.module.exports;

['singular', 'plural', 'both', 'neither'].forEach(function(form) {
   var resting = { name: 'none', priority: -100 };
   var source = { property: 'custom-request', value: true, nextState: 'movie' };
   var action = { property: 'custom-output', value: { nested: true } };
   if (form === 'singular' || form === 'both') { resting.source = source; resting.action = action; }
   if (form === 'plural' || form === 'both') {
      resting.sources = [form === 'both' ? { property: 'ignored-source' } : source];
      resting.actions = [form === 'both' ? { property: 'ignored-action' } : action];
   }
   var config = { name: 'SCENE', modeName: 'SCENE', restingMode: resting,
      modes: [{ name: 'movie' }, { name: 'evening' }] };
   var original = JSON.stringify(config);
   var firstGenerated;
   for (var attempt = 0; attempt < 2; ++attempt) {
      var property = new ModeProperty(config);
      var generated = property.config.states[0];
      var snapshot = JSON.stringify(generated);
      if (attempt === 0) firstGenerated = snapshot;
      else assert.strictEqual(snapshot, firstGenerated, 'reusing config must not accumulate generated entries');
      assert.strictEqual(generated.hasOwnProperty('source'), false);
      assert.strictEqual(generated.hasOwnProperty('action'), false);
      var owner = { uName: ':room:SCENE', owner: { uName: ':room' },
         addChildNamedObject: function() {},
         fetchOrCreateSourceListener: function(input) { return { sourceEventName: input.property }; }
      };
      var state = new State(generated, owner);
      assert.deepStrictEqual(state.sources.map(function(item) { return item.property; }),
         (form === 'neither' ? [] : ['custom-request']).concat([
            'SCENE-ACTIVES-VALID', 'MOVIE-SCENE-ACTIVE', 'EVENING-SCENE-ACTIVE']));
      assert.deepStrictEqual(state.sources.slice(-3).map(function(item) { return item.nextState; }),
         ['invalid', 'movie', 'evening']);
      assert.deepStrictEqual(state.actions.map(function(item) { return item.property; }),
         (form === 'neither' ? [] : ['custom-output']).concat(['NONE-SCENE-DURATION']));
      assert.strictEqual(state.actions[state.actions.length - 1].value, -1);
      assert.strictEqual(JSON.stringify(config), original, 'construction must preserve caller config');
      if (form !== 'neither') generated.actions[0].value.nested = false;
      assert.strictEqual(JSON.stringify(config), original, 'nested config must be independent');
   }
   process.stdout.write('[PASS] Resting mode ' + form + ': real State normalisation and repeated config reuse\n');
});
