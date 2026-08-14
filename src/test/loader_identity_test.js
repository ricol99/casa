var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var Loader = require('../loader');

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

function createTempConfigPath() {
   return fs.mkdtempSync(path.join(os.tmpdir(), "casa-loader-identity-"));
}

function createLoader(_casaName, _configPath, _listeningPort) {
   return new Loader(_casaName, true, false, "/tmp", _configPath, "test", false, false, 1, null, _listeningPort);
}

runTest("loader keeps explicit Casa name", function() {
   var configPath = createTempConfigPath();
   var loader = createLoader("kitchen", configPath);

   fs.writeFileSync(path.join(configPath, "casa-identity.json"), JSON.stringify({ casaName: "garage" }));

   assert.strictEqual(loader.resolveCasaName(), true);
   assert.strictEqual(loader.casaName, "kitchen");
});

runTest("loader resolves Casa name from identity file", function() {
   var configPath = createTempConfigPath();
   var loader = createLoader(undefined, configPath);

   fs.writeFileSync(path.join(configPath, "casa-identity.json"), JSON.stringify({ casaName: "garage" }));

   assert.strictEqual(loader.resolveCasaName(), true);
   assert.strictEqual(loader.casaName, "garage");
});

runTest("loader reports unresolved Casa name without identity file", function() {
   var configPath = createTempConfigPath();
   var loader = createLoader(undefined, configPath);

   assert.strictEqual(loader.resolveCasaName(), false);
   assert.strictEqual(loader.casaName, undefined);
});

runTest("loader creates minimal unregistered config", function() {
   var configPath = createTempConfigPath();
   var loader = createLoader(undefined, configPath);

   loader.createUnregisteredConfig();

   assert.ok(loader.casaName.indexOf("unregistered-") === 0);
   assert.strictEqual(loader.casaConfig.unregistered, true);
   assert.strictEqual(loader.casaConfig.connectToPeers, true);
   assert.deepStrictEqual(loader.casaConfig.services, [
      { name: "casa-discovery-service", type: "casadiscoveryservice" },
      { name: "console-api-service", type: "consoleapiservice" },
      { name: "event-logging-service", type: "eventloggingservice" }
   ]);
   assert.strictEqual(loader.gangConfig.name, "unregistered");
   assert.strictEqual(loader.gangConfig.unregistered, true);
   assert.strictEqual(loader.gangConfig.discoverable, true);
   assert.strictEqual(loader.gangConfig.publicDiscoverable, false);
   assert.deepStrictEqual(loader.gangConfig.allowedSubscriberGangs, []);
   assert.strictEqual(loader.gangConfig.casa, loader.casaConfig);
});

runTest("loader applies port override to unregistered config", function() {
   var configPath = createTempConfigPath();
   var loader = createLoader(undefined, configPath, 9101);

   loader.createUnregisteredConfig();

   assert.strictEqual(loader.casaConfig.listeningPort, 9101);
});

process.stdout.write("All loader identity tests passed.\n");
