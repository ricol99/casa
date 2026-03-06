var assert = require('assert');
var ConfigPreviewEngine = require('../consoleapis/configpreviewengine');

function runTest(_name, _fn) {
   try {
      _fn();
      process.stdout.write("[PASS] " + _name + "\n");
   }
   catch (_err) {
      process.stderr.write("[FAIL] " + _name + "\n");
      process.stderr.write(_err.stack + "\n");
      process.exit(1);
   }
}

function runAsyncTest(_name, _fn) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write((_err && _err.stack) ? _err.stack : (_err + "\n"));
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
      process.stdout.write("All preview config engine tests passed.\n");
   });
}

function deepCopy(_obj) {
   return (_obj === undefined) ? _obj : JSON.parse(JSON.stringify(_obj));
}

function createContext(_beforeResolve, _beforeUsage, _defaultCasa, _peerCasas) {
   var defaultCasa = _defaultCasa ? _defaultCasa : "casa-a";
   var peerCasas = _peerCasas ? _peerCasas : [ "casa-b" ];
   var peercasas = {};

   for (var i = 0; i < peerCasas.length; ++i) {
      peercasas[peerCasas[i]] = {};
   }

   return {
      mode: "gang",
      gangName: "gang-test",
      defaultCasaName: defaultCasa,
      gang: {
         casa: { name: defaultCasa },
         peercasas: peercasas
      },
      resolveSourceFn: function(_sourceUName) {
         return deepCopy((_beforeResolve && _beforeResolve[_sourceUName]) ? _beforeResolve[_sourceUName] : {
            sourceUName: _sourceUName,
            exists: false,
            activeOwnerCasa: null,
            activeProviderType: null,
            instances: []
         });
      },
      sourceUsageFn: function(_sourceUName) {
         return deepCopy((_beforeUsage && _beforeUsage[_sourceUName]) ? _beforeUsage[_sourceUName] : {
            sourceUName: _sourceUName,
            exists: false,
            activeOwnerCasa: null,
            activeProviderType: null,
            instanceCount: 0,
            consumerCount: 0,
            subscriptionCount: 0,
            filters: { activeOnly: false, hasConsumers: false },
            instances: []
         });
      }
   };
}

runTest("previewConfig rejects invalid JSON patch strings", function() {
   var out = ConfigPreviewEngine.previewConfig({ patch: "{invalid", includeUsage: false }, createContext());

   assert.strictEqual(out.ok, false);
   assert.ok(out.errors && out.errors.length > 0);
   assert.ok(String(out.errors[0]).indexOf("Invalid patch JSON") !== -1);
});

runTest("previewConfig rejects unknown explicit operation fields", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", bogusField: 1 }
         ]
      }
   }, createContext());

   assert.strictEqual(out.ok, false);
   assert.ok(out.errors.some( (_error) => String(_error).indexOf("unknown field") !== -1 ));
});

runTest("previewConfig rejects explicit operation bad types", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", priority: "high" }
         ]
      }
   }, createContext());

   assert.strictEqual(out.ok, false);
   assert.ok(out.errors.some( (_error) => String(_error).indexOf("priority must be a finite number") !== -1 ));
});

runTest("explicit operation can change active owner and keep usage structure", function() {
   var beforeResolve = {
      ":x": {
         sourceUName: ":x",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 0, state: "active", inSourcesMap: true, inBowingMap: false, connected: true, scope: "casa" },
            { ownerCasa: "casa-b", providerType: "peercasa", type: "peersource", superType: null, priority: -1, state: "bowed", inSourcesMap: true, inBowingMap: true, connected: true, scope: "runtime" }
         ]
      }
   };
   var beforeUsage = {
      ":x": {
         sourceUName: ":x",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instanceCount: 2,
         consumerCount: 1,
         subscriptionCount: 2,
         filters: { activeOnly: false, hasConsumers: false },
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 0, state: "active", connected: true, inSourcesMap: true, inBowingMap: false, scope: "casa", consumerCount: 1, subscriptionCount: 2, consumers: [ { sourceUName: ":y", count: 2 } ] },
            { ownerCasa: "casa-b", providerType: "peercasa", type: "peersource", superType: null, priority: -1, state: "bowed", connected: true, inSourcesMap: true, inBowingMap: true, scope: "runtime", consumerCount: 0, subscriptionCount: 0, consumers: [] }
         ]
      }
   };

   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", scope: "casa", ownerCasa: "casa-b", patch: { priority: 5, type: "bedroom" } }
         ]
      },
      includeUsage: true
   }, createContext(beforeResolve, beforeUsage));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.summary.impactedSourceCount, 1);
   assert.strictEqual(out.summary.changedActiveOwnerCount, 1);
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-b");
   assert.strictEqual(out.impactedSources[0].delta.activeOwnerChanged, true);
   assert.ok(out.impactedSources[0].after.usage);
   assert.strictEqual(out.impactedSources[0].after.usage.sourceUName, ":x");
});

runTest("limit truncates impacted source set", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":a", scope: "casa", ownerCasa: "casa-a", patch: { priority: 1 } },
            { action: "upsert", sourceUName: ":b", scope: "casa", ownerCasa: "casa-a", patch: { priority: 2 } }
         ]
      },
      includeUsage: false,
      limit: 1
   }, createContext());

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.summary.impactedSourceCount, 1);
   assert.strictEqual(out.summary.truncated, true);
   assert.ok(out.warnings.some( (_warning) => _warning.indexOf("truncated") !== -1 ));
});

runTest("implicit gang patch identifies source and simulates added instances", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         gang: {
            things: [
               { name: "test-room", type: "room", priority: 3 }
            ]
         }
      },
      includeUsage: true
   }, createContext({}, {}, "casa-a", [ "casa-b" ]));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.summary.impactedSourceCount, 1);
   assert.strictEqual(out.summary.addedSourceCount, 1);
   assert.strictEqual(out.impactedSources[0].sourceUName, ":test-room");
   assert.strictEqual(out.impactedSources[0].after.resolve.exists, true);
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-a");
   assert.strictEqual(out.impactedSources[0].after.resolve.instances.length, 2);
});

runTest("remove operation drops instance and promotes fallback owner", function() {
   var beforeResolve = {
      ":x": {
         sourceUName: ":x",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 2, state: "active", inSourcesMap: true, inBowingMap: false, connected: true, scope: "casa" },
            { ownerCasa: "casa-b", providerType: "peercasa", type: "peersource", superType: null, priority: 1, state: "bowed", inSourcesMap: true, inBowingMap: true, connected: true, scope: "runtime" }
         ]
      }
   };

   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "remove", sourceUName: ":x", ownerCasa: "casa-a", scope: "casa" }
         ]
      }
   }, createContext(beforeResolve, {}));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-b");
   assert.ok(out.impactedSources[0].delta.removedInstances.length >= 1);
   assert.strictEqual(out.summary.changedActiveOwnerCount, 1);
});

runTest("disconnected higher priority candidate does not become active", function() {
   var beforeResolve = {
      ":x": {
         sourceUName: ":x",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 1, state: "active", inSourcesMap: true, inBowingMap: false, connected: true, scope: "casa" },
            { ownerCasa: "casa-b", providerType: "peercasa", type: "peersource", superType: null, priority: 0, state: "bowed", inSourcesMap: true, inBowingMap: true, connected: true, scope: "runtime" }
         ]
      }
   };

   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", ownerCasa: "casa-b", scope: "casa", patch: { priority: 5, connected: false } }
         ]
      }
   }, createContext(beforeResolve, {}));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-a");
   var afterInstances = out.impactedSources[0].after.resolve.instances;
   var b = afterInstances.find( (_item) => _item.ownerCasa === "casa-b" );
   assert.ok(b);
   assert.strictEqual(b.state, "unavailable");
});

runTest("equal priority tie-break chooses lexical owner casa", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", ownerCasa: "casa-b", scope: "casa", patch: { priority: 5, type: "room" } },
            { action: "upsert", sourceUName: ":x", ownerCasa: "casa-a", scope: "casa", patch: { priority: 5, type: "room" } }
         ]
      }
   }, createContext({}, {}));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-a");
});

runTest("targetCasaName applies default owner for scope=casa operations", function() {
   var beforeResolve = {
      ":x": {
         sourceUName: ":x",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 2, state: "active", inSourcesMap: true, inBowingMap: false, connected: true, scope: "casa" },
            { ownerCasa: "casa-b", providerType: "peercasa", type: "peersource", superType: null, priority: 0, state: "bowed", inSourcesMap: true, inBowingMap: true, connected: true, scope: "runtime" }
         ]
      }
   };

   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":x", scope: "casa", patch: { priority: 6 } }
         ]
      },
      targetCasaName: "casa-b"
   }, createContext(beforeResolve, {}));

   assert.strictEqual(out.ok, true);
   assert.strictEqual(out.scope.targetCasa, "casa-b");
   assert.strictEqual(out.impactedSources[0].after.resolve.activeOwnerCasa, "casa-b");
});

runTest("summaryOnly returns summary without impacted source payload", function() {
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":a", scope: "casa", ownerCasa: "casa-a", patch: { priority: 1 } },
            { action: "upsert", sourceUName: ":b", scope: "casa", ownerCasa: "casa-a", patch: { priority: 2 } }
         ]
      },
      summaryOnly: true
   }, createContext({}, {}));

   assert.strictEqual(out.ok, true);
   assert.ok(out.output);
   assert.strictEqual(out.output.mode, "summary");
   assert.strictEqual(out.output.impactedTotalCount, 2);
   assert.strictEqual(out.output.impactedReturnedCount, 0);
   assert.strictEqual(out.impactedSources.length, 0);
   assert.strictEqual(out.summary.impactedSourceCount, 2);
});

runTest("topChanged returns only changed source details", function() {
   var beforeResolve = {
      ":a": {
         sourceUName: ":a",
         exists: true,
         activeOwnerCasa: "casa-a",
         activeProviderType: "casa",
         instances: [
            { ownerCasa: "casa-a", providerType: "casa", type: "bedroom", superType: "thing", priority: 1, state: "active", inSourcesMap: true, inBowingMap: false, connected: true, scope: "casa" }
         ]
      }
   };
   var out = ConfigPreviewEngine.previewConfig({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":a", scope: "casa", ownerCasa: "casa-a", patch: { priority: 1, type: "bedroom" } },
            { action: "upsert", sourceUName: ":b", scope: "casa", ownerCasa: "casa-a", patch: { priority: 2, type: "bedroom" } },
            { action: "upsert", sourceUName: ":c", scope: "casa", ownerCasa: "casa-a", patch: { priority: 3, type: "bedroom" } }
         ]
      },
      topChanged: 1
   }, createContext(beforeResolve, {}));

   assert.strictEqual(out.ok, true);
   assert.ok(out.output);
   assert.strictEqual(out.output.mode, "top-changed");
   assert.strictEqual(out.summary.impactedSourceCount, 3);
   assert.strictEqual(out.summary.changedSourceCount, 2);
   assert.strictEqual(out.output.changedTotalCount, 2);
   assert.strictEqual(out.output.changedReturnedCount, 1);
   assert.strictEqual(out.impactedSources.length, 1);
   assert.strictEqual(out.impactedSources[0].sourceUName, ":b");
   assert.ok(out.warnings.some( (_warning) => _warning.indexOf("topChanged=1") !== -1 ));
});

runTest("previewConfig validates summaryOnly and topChanged option types", function() {
   var out1 = ConfigPreviewEngine.previewConfig({
      patch: { changes: [ { action: "upsert", sourceUName: ":a", scope: "casa" } ] },
      summaryOnly: "yes"
   }, createContext({}, {}));
   var out2 = ConfigPreviewEngine.previewConfig({
      patch: { changes: [ { action: "upsert", sourceUName: ":a", scope: "casa" } ] },
      topChanged: -1
   }, createContext({}, {}));

   assert.strictEqual(out1.ok, false);
   assert.ok(out1.errors.some( (_error) => String(_error).indexOf("summaryOnly must be a boolean") !== -1 ));
   assert.strictEqual(out2.ok, false);
   assert.ok(out2.errors.some( (_error) => String(_error).indexOf("topChanged must be a non-negative number") !== -1 ));
});

runAsyncTest("previewConfigAsync emits progress events and completes", function(_done) {
   var progressEvents = [];

   ConfigPreviewEngine.previewConfigAsync({
      patch: {
         changes: [
            { action: "upsert", sourceUName: ":a", scope: "casa", ownerCasa: "casa-a", patch: { priority: 1 } },
            { action: "upsert", sourceUName: ":b", scope: "casa", ownerCasa: "casa-a", patch: { priority: 2 } }
         ]
      }
   }, createContext({}, {}), function(_event) {
      progressEvents.push(_event);
   }, function(_result) {

      try {
         assert.strictEqual(_result.ok, true);
         assert.strictEqual(_result.summary.impactedSourceCount, 2);
         assert.ok(progressEvents.length >= 2);
         assert.strictEqual(progressEvents[0].event, "preview-started");
         assert.strictEqual(progressEvents[progressEvents.length - 1].event, "preview-complete");
         assert.strictEqual(progressEvents[progressEvents.length - 1].percent, 100);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });
});
