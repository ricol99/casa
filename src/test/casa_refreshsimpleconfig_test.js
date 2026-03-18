var assert = require('assert');
var util = require('util');
var NamedObject = require('../namedobject');
var Casa = require('../casa');

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

function FakeGang(_config) {
   NamedObject.call(this, _config);
}

util.inherits(FakeGang, NamedObject);

FakeGang.prototype.superType = function() {
   return "gang";
};

FakeGang.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
};

function FakeThing(_config, _owner) {
   NamedObject.call(this, _config, _owner);
   this.priority = _config.hasOwnProperty("priority") ? _config.priority : 0;
   this.controllerPriority = _config.hasOwnProperty("controllerPriority") ? _config.controllerPriority : -1;
   this.local = _config.hasOwnProperty("local") ? _config.local : false;
   this.fromPeer = _config.hasOwnProperty("fromPeer") ? _config.fromPeer : false;
   this.gang = _config.gang;
   this.config = _config;
}

util.inherits(FakeThing, NamedObject);

FakeThing.prototype.superType = function() {
   return "thing";
};

FakeThing.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   _exportObj.type = this.type;
   _exportObj.priority = this.priority;
   _exportObj.controllerPriority = this.controllerPriority;
};

runTest("refreshSimpleConfig exports bowed local sources from bowingRoot", function() {
   var gang = new FakeGang({ name: "gang-test", type: "gang" });
   var bowingRoot = new NamedObject({ name: "bow-root", type: "namedobject", transient: true });
   var casa = {
      name: "casa-a",
      displayName: "Casa A",
      gang: gang,
      bowingRoot: bowingRoot,
      shouldExportChildInSharedConfig: Casa.prototype.shouldExportChildInSharedConfig
   };

   gang.name = "gang-test";

   var bowedSource = new FakeThing({
      name: "test-1-bedroom",
      type: "bedroom",
      priority: 0,
      controllerPriority: -1,
      local: false,
      fromPeer: false,
      gang: gang,
      _db: "casa-a"
   }, bowingRoot);

   bowedSource.gang = gang;

   var simpleConfig = Casa.prototype.refreshSimpleConfig.call(casa);
   var exportedSource = simpleConfig.exportTree &&
                        simpleConfig.exportTree.myNamedObjects &&
                        simpleConfig.exportTree.myNamedObjects["test-1-bedroom"];

   assert.ok(exportedSource);
   assert.strictEqual(exportedSource.uName, ":test-1-bedroom");
   assert.strictEqual(exportedSource.type, "peersource");
   assert.strictEqual(exportedSource.superType, "peersource");
   assert.strictEqual(exportedSource.priority, 0);
});

process.stdout.write("All casa refreshSimpleConfig tests passed.\n");
