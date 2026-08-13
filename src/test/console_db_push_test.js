var assert = require('assert');
var GangConsoleCmd = require('../consolecmds/gangconsolecmd');
var GangConsoleApi = require('../consoleapis/gangconsoleapi');

function runAsyncTest(_name, _fn, _callback) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write(_err.stack ? _err.stack : _err + "\n");
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
      _callback();
   });
}

function createDb(_name, _docs) {
   return {
      name: _name,
      getHash: function() {
         return { hash: "hash-" + _name, lastModified: new Date(0) };
      },
      readAll: function(_callback) {
         _callback(null, _docs);
      }
   };
}

runAsyncTest("gang pushDb sends raw docs over replaceDb", function(_done) {
   var docs = [
      { _collection: "gang", _id: "gang-collin", name: "gang-collin", type: "gang", organisation: "collin-org" }
   ];
   var captured = null;
   var cmd = Object.create(GangConsoleCmd.prototype);

   cmd.gang = {
      getDb: function() {
         return createDb("gang-collin-db", docs);
      }
   };
   cmd.executeParsedCommandOnAllCasas = function(_method, _arguments, _callback) {
      captured = { method: _method, arguments: _arguments };
      _callback(null, true);
   };

   cmd.pushDb([], function(_err, _result) {

      if (_err) {
         return _done(_err);
      }

      assert.strictEqual(_result, true);
      assert.strictEqual(captured.method, "replaceDb");
      assert.strictEqual(captured.arguments.length, 1);
      assert.strictEqual(captured.arguments[0].dbName, "gang-collin-db");
      assert.deepStrictEqual(captured.arguments[0].docs, docs);
      assert.strictEqual(captured.arguments[0].hash.hash, "hash-gang-collin-db");
      _done();
   });
}, function() {
   runAsyncTest("gang replaceDb accepts socket payload", function(_done) {
      var api = Object.create(GangConsoleApi.prototype);
      var payload = {
         dbName: "gang-collin-db",
         docs: [
            { _collection: "gang", _id: "gang-collin", name: "gang-collin", type: "gang" }
         ]
      };

      api.dbService = {
         replaceDbFromDocs: function(_dbName, _docs, _callback) {
            assert.strictEqual(_dbName, payload.dbName);
            assert.deepStrictEqual(_docs, payload.docs);
            _callback(null, { dbName: _dbName, hash: { hash: "remote-hash" } });
         }
      };

      api.replaceDb({}, [ payload ], function(_err, _result) {

         if (_err) {
            return _done(_err);
         }

         assert.deepStrictEqual(_result, { dbName: "gang-collin-db", hash: { hash: "remote-hash" } });
         _done();
      });
   }, function() {
      process.stdout.write("All console db push tests passed.\n");
   });
});
