var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var EventEmitter = require('events');
var McpService = require('../services/mcpservice');
var CasaConsoleApi = require('../consoleapis/casaconsoleapi');
var GangConsoleApi = require('../consoleapis/gangconsoleapi');

(async function() {
   var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'casa-mcp-management-'));
   try {
      var stored = {
         'test-casa-db': [{ _id: 'casa', _collection: 'casa', name: 'test-casa' }],
         'test-gang-db': [{ _id: 'gang', _collection: 'gang', name: 'test-gang' }]
      };
      var writes = 0, restarts = 0, failWrite = false;
      var service = Object.create(McpService.prototype);
      var casaApi = Object.create(CasaConsoleApi.prototype);
      var gangApi = Object.create(GangConsoleApi.prototype);
      var gang = service.gang = {
         name: 'test-gang', configPath: function() { return dir; },
         getDb: function(name) { return { readAll: function(cb) { cb(null, stored[name || 'test-gang-db']); } }; }
      };
      var casa = gang.casa = {
         name: 'test-casa', getDb: function() { return gang.getDb('test-casa-db'); },
         findService: function(name) {
            assert.strictEqual(name, 'consoleapiservice');
            return { findOrCreateConsoleApiObject: function(object) {
               assert(object === casa || object === gang);
               return object === casa ? casaApi : gangApi;
            } };
         }
      };
      casaApi.gang = gang; gangApi.gang = gang;
      casaApi.ensureDbServiceAvailable = function() { return true; };
      casaApi.dbService = { replaceDbFromDocs: function(name, docs, cb) {
         writes++;
         if (failWrite) { failWrite = false; return cb('simulated failure'); }
         stored[name] = JSON.parse(JSON.stringify(docs)); cb(null, true);
      } };
      casaApi.previewConfigInternal = function(options) { assert.deepStrictEqual(options, { patch: { changes: [] } }); return { ok: true }; };
      casaApi.restart = function(session, params, cb) { restarts++; cb(null, true); };
      function call(name, args, finish) {
         return new Promise(function(resolve) {
            var response = new EventEmitter();
            response.status = function() { return this; };
            response.json = function(value) { resolve(value); if (finish) this.emit('finish'); };
            service.handleToolCall(1, { name: 'casa.' + name, arguments: args }, response);
         });
      }
      var result = await call('export_config', { scope: 'casa' });
      var exported = result.result.structuredContent;
      assert.deepStrictEqual(exported.docs, stored['test-casa-db']);
      result = await call('export_config', { scope: 'gang' });
      assert.deepStrictEqual(result.result.structuredContent.docs, stored['test-gang-db']);
      result = await call('preview_config', { options: { patch: { changes: [] } } });
      assert.strictEqual(result.result.structuredContent.ok, true);
      var docs = exported.docs.map(function(doc) { return Object.assign({}, doc, { label: 'updated' }); });
      result = await call('deploy_config', { scope: 'casa', expectedRevision: 'stale', docs: docs });
      assert(result.error); assert.strictEqual(writes, 0);
      result = await call('deploy_config', { scope: 'casa', expectedRevision: exported.revision, docs: [{ _id: 'wrong', _collection: 'casa', name: 'wrong' }] });
      assert(result.error); assert.strictEqual(writes, 0);
      result = await call('deploy_config', { scope: 'casa', expectedRevision: exported.revision, docs: docs });
      var deployed = result.result.structuredContent;
      assert.strictEqual(deployed.appliedToRuntime, false);
      assert.deepStrictEqual(stored['test-casa-db'], docs);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(deployed.backup)).docs, exported.docs);
      assert.strictEqual(fs.statSync(deployed.backup).mode & 0o777, 0o600);
      failWrite = true;
      result = await call('deploy_config', { scope: 'casa', expectedRevision: deployed.revision, docs: exported.docs });
      assert(result.error.message.includes('rollback completed'));
      assert.deepStrictEqual(stored['test-casa-db'], docs);
      assert.strictEqual(service.configWriteInProgress, false);
      result = await call('restart', { casaName: 'wrong' }, true); assert(result.error);
      gang.ignoreRestart = true;
      result = await call('restart', { casaName: casa.name }, true); assert(result.error);
      gang.ignoreRestart = false;
      result = await call('restart', { casaName: casa.name }, true);
      assert.strictEqual(result.result.structuredContent.accepted, true);
      assert.strictEqual(restarts, 0, 'response must precede restart');
      result = await call('restart', { casaName: casa.name }, true); assert(result.error);
      await new Promise(function(resolve) { setTimeout(resolve, 150); });
      assert.strictEqual(restarts, 1);
      assert.strictEqual(service.restartPending, false);
      process.stdout.write('[PASS] MCP paired config export/preview/replace, revision, backup, rollback and deferred restart\n');
   } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(function(error) { console.error(error); process.exitCode = 1; });
