var assert = require('assert');
var GangCasaAddress = require('../gangcasaaddress');

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

runTest("renders a readable gang casa address", function() {
   var address = new GangCasaAddress({ gang: "farm-gate", casa: ":barn-controller" });

   assert.strictEqual(address.toString(), "gang-casa://farm-gate/:barn-controller");
});

runTest("parses a readable gang casa address", function() {
   var address = GangCasaAddress.fromString("gang-casa://farm-gate/:barn-controller");

   assert.deepStrictEqual(address.export(), {
      gang: "farm-gate",
      casa: ":barn-controller"
   });
});

runTest("round-trips encoded spaces and reserved characters", function() {
   var address = new GangCasaAddress({ gang: "farm gate", casa: ":barn controller/primary?#1" });
   var rendered = address.toString();
   var parsed = GangCasaAddress.fromString(rendered);

   assert.strictEqual(rendered, "gang-casa://farm%20gate/:barn%20controller%2Fprimary%3F%231");
   assert.deepStrictEqual(parsed.export(), address.export());
});

runTest("preserves colons in casa uNames", function() {
   var address = GangCasaAddress.fromString("gang-casa://farm-gate/:barn:controller");

   assert.strictEqual(address.casa, ":barn:controller");
   assert.strictEqual(address.toString(), "gang-casa://farm-gate/:barn:controller");
});

runTest("rejects non-gang-casa schemes", function() {
   assert.throws(function() {
      GangCasaAddress.fromString("gang://farm-gate/:building");
   }, /gang-casa:\/\//);
});

runTest("rejects missing gang or casa", function() {
   assert.throws(function() {
      GangCasaAddress.fromString("gang-casa:///:barn");
   }, /gang and casa/);

   assert.throws(function() {
      GangCasaAddress.fromString("gang-casa://farm-gate/");
   }, /requires casa/);
});

runTest("rejects casa names that are not Casa uNames", function() {
   assert.throws(function() {
      GangCasaAddress.fromString("gang-casa://farm-gate/barn");
   }, /start with ':'/);
});
