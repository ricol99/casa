var assert = require('assert');
var Gang = require('../gang');

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

function createGangConfig(_updates) {
   var config = {
      name: "gang-collin",
      type: "gang",
      casa: {
         name: "casa-console",
         type: "casa",
         listeningPort: 8999
      }
   };

   for (var key in _updates) {

      if (_updates.hasOwnProperty(key)) {
         config[key] = _updates[key];
      }
   }

   return config;
}

runTest("gang management flags default private and deny subscribers", function() {
   var gang = new Gang(createGangConfig({}), {});

   assert.strictEqual(gang.isUnregistered(), false);
   assert.strictEqual(gang.isDiscoverable(), false);
   assert.strictEqual(gang.isPublicDiscoverable(), false);
   assert.deepStrictEqual(gang.getAllowedSubscriberGangs(), []);
   assert.strictEqual(gang.canGangSubscribe("workshop"), false);
   assert.strictEqual(gang.canGangWrite("workshop"), false);
});

runTest("gang management flags preserve config", function() {
   var gang = new Gang(createGangConfig({
      organisation: "collin-home",
      unregistered: true,
      discoverable: true,
      publicDiscoverable: true,
      allowedSubscriberGangs: [
         "farm-gate",
         { gang: "workshop", readOnly: false },
         { name: "studio" }
      ]
   }), {});

   assert.strictEqual(gang.getOrganisation(), "collin-home");
   assert.strictEqual(gang.isUnregistered(), true);
   assert.strictEqual(gang.isDiscoverable(), true);
   assert.strictEqual(gang.isPublicDiscoverable(), true);
   assert.deepStrictEqual(gang.getAllowedSubscriberGangs(), [
      { gang: "farm-gate", readOnly: true },
      { gang: "workshop", readOnly: false },
      { gang: "studio", readOnly: true }
   ]);
   assert.strictEqual(gang.canGangSubscribe("farm-gate"), true);
   assert.strictEqual(gang.canGangSubscribe("workshop"), true);
   assert.strictEqual(gang.canGangWrite("farm-gate"), false);
   assert.strictEqual(gang.canGangWrite("workshop"), true);
});

runTest("gang getDb is safe before any database is registered", function() {
   var gang = new Gang(createGangConfig({}), {});

   assert.deepStrictEqual(gang.dbs, {});
   assert.strictEqual(gang.getDb(), null);
});

runTest("gang addDb registers open database handles", function() {
   var gang = new Gang(createGangConfig({}), {});
   var db = { name: "gang-collin-db" };

   assert.strictEqual(gang.addDb(db), db);
   assert.strictEqual(gang.getDb(), db);
});

process.stdout.write("All gang config tests passed.\n");
