var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var Casa = require('../casa');
var CasaConsoleApi = require('../consoleapis/casaconsoleapi');

function runAsyncTest(_name, _fn) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write((_err.stack ? _err.stack : _err) + "\n");
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
   });
}

function createCasa(_configPath, _unregistered) {
   var casa = Object.create(Casa.prototype);

   casa.configPath = _configPath;
   casa.gang = {
      isUnregistered: function() {
         return _unregistered;
      }
   };
   casa.localMacAddress = function() {
      return "aa:bb:cc:dd:ee:ff";
   };

   return casa;
}

function createCasaConsoleApi(_casa) {
   var api = Object.create(CasaConsoleApi.prototype);

   api.gang = {
      casa: _casa
   };

   return api;
}

runAsyncTest("casa console api claim writes identity file", function(_done) {
   var configPath = fs.mkdtempSync(path.join(os.tmpdir(), "casa-bootstrap-claim-"));
   var casa = createCasa(configPath, true);
   var api = createCasaConsoleApi(casa);

   api.claimUnregisteredCasa({}, [ {
      casaName: "kitchen",
      gangName: "gang-collin",
      macAddress: "aa-bb-cc-dd-ee-ff"
   } ], function(_err, _result) {
      var identity;

      if (_err) {
         return _done(_err);
      }

      try {
         assert.strictEqual(_result.ok, true);
         assert.strictEqual(_result.casaName, "kitchen");
         assert.strictEqual(_result.gangName, "gang-collin");
         assert.strictEqual(_result.macAddress, "aa:bb:cc:dd:ee:ff");
         assert.strictEqual(_result.restartRequired, true);

         identity = JSON.parse(fs.readFileSync(path.join(configPath, "casa-identity.json"), "utf8"));
         assert.strictEqual(identity.casaName, "kitchen");
         assert.strictEqual(identity.gangName, "gang-collin");
         assert.strictEqual(identity.macAddress, "aa:bb:cc:dd:ee:ff");
         _done();
      }
      catch (_assertErr) {
         _done(_assertErr);
      }
   });
});

runAsyncTest("registered casa rejects console api bootstrap claim", function(_done) {
   var configPath = fs.mkdtempSync(path.join(os.tmpdir(), "casa-bootstrap-claim-"));
   var casa = createCasa(configPath, false);
   var api = createCasaConsoleApi(casa);

   api.claimUnregisteredCasa({}, [ {
      casaName: "kitchen",
      macAddress: "aa:bb:cc:dd:ee:ff"
   } ], function(_err, _result) {

      try {
         assert.match(_err.message, /already registered/);
         assert.strictEqual(_err.statusCode, 409);
         assert.strictEqual(_result, undefined);
         _done();
      }
      catch (_assertErr) {
         _done(_assertErr);
      }
   });
});
