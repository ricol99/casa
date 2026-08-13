var assert = require('assert');
var Console = require('../console');
var ConsoleCmd = require('../consolecmd');

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

function createConsole(_gangName, _organisation) {
   var consoleObj = Object.create(Console.prototype);

   consoleObj.gang = {
      name: _gangName,
      getOrganisation: function() {
         return _organisation;
      }
   };

   return consoleObj;
}

function createLocalGangDb(_gangName, _organisation, _includeOrganisation) {
   return {
      find: function(_name, _callback) {
         assert.strictEqual(_name, _gangName);
         var config = {
            name: _gangName,
            type: "gang"
         };

         if (_includeOrganisation !== false) {
            config.organisation = _organisation;
         }

         _callback(null, config);
      }
   };
}

function createSyncCmd(_remoteDocs) {
   var cmd = Object.create(ConsoleCmd.prototype);

   cmd.uName = ":";
   cmd.writeCalled = false;
   cmd.console = {
      sendCommandToCasa: function(_remoteCasa, _args, _method, _callback) {
         assert.strictEqual(_method, "executeParsedCommand");
         _callback(null, _remoteDocs);
      }
   };
   cmd.writeSyncedDb = function(_dbName, _docs, _callback) {
      this.writeCalled = true;
      _callback(null, {
         getHash: function() {
            return { hash: "new-local-hash" };
         }
      });
   };

   return cmd;
}

runAsyncTest("gang db sync validation protects local organisation", function(_done) {
   var consoleObj = createConsole("gang-collin");
   var localDb = createLocalGangDb("gang-collin", "collin-org", true);
   var remoteDocs = [
      { _collection: "gang", _id: "gang-collin", name: "gang-collin", type: "gang" }
   ];

   consoleObj.validateGangDbSyncDocs(localDb, remoteDocs, {}, function(_err, _result) {

      if (_err) {
         return _done(_err);
      }

      assert.strictEqual(_result.shouldPull, false);
      assert.strictEqual(_result.reason, "organisation-conflict");
      assert.strictEqual(_result.localOrganisation, "collin-org");
      assert.strictEqual(_result.remoteOrganisation, null);
      _done();
   });
}, function() {
   runAsyncTest("gang db sync validation uses runtime organisation fallback", function(_done) {
      var consoleObj = createConsole("gang-collin", "collin-org");
      var localDb = createLocalGangDb("gang-collin", null, false);
      var remoteDocs = [
         { _collection: "gang", _id: "gang-collin", name: "gang-collin", type: "gang" }
      ];

      consoleObj.validateGangDbSyncDocs(localDb, remoteDocs, {}, function(_err, _result) {

         if (_err) {
            return _done(_err);
         }

         assert.strictEqual(_result.shouldPull, false);
         assert.strictEqual(_result.reason, "organisation-conflict");
         assert.strictEqual(_result.localOrganisation, "collin-org");
         assert.strictEqual(_result.remoteOrganisation, null);
         _done();
      });
   }, function() {
      runAsyncTest("syncDbFromRemoteCasa honours validation skip", function(_done) {
      var cmd = createSyncCmd([
         { _collection: "gang", _id: "gang-collin", name: "gang-collin", type: "gang" }
      ]);

      cmd.syncDbFromRemoteCasa({
         remoteCasa: { connected: true },
         remoteDbInfo: {
            dbName: "gang-collin-db",
            hash: "remote-hash",
            lastModified: "2026-08-13T11:00:00.000Z"
         },
         localDb: {
            getHash: function() {
               return {
                  hash: "local-hash",
                  lastModified: "2026-08-13T10:00:00.000Z"
               };
            }
         },
         dbName: "gang-collin-db",
         objUName: ":",
         validateRemoteDocs: function(_docs, _state, _callback) {
            assert.strictEqual(_state.reason, "remote-newer");
            _callback(null, {
               shouldPull: false,
               action: "skipped",
               reason: "organisation-conflict",
               localOrganisation: "collin-org",
               remoteOrganisation: null
            });
         }
      }, function(_err, _result) {

         if (_err) {
            return _done(_err);
         }

         assert.strictEqual(cmd.writeCalled, false);
         assert.strictEqual(_result.action, "skipped");
         assert.strictEqual(_result.reason, "organisation-conflict");
         assert.strictEqual(_result.localOrganisation, "collin-org");
         assert.strictEqual(_result.remoteOrganisation, null);
         _done();
      });
      }, function() {
         process.stdout.write("All console gang db sync tests passed.\n");
      });
   });
});
