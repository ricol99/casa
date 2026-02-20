var assert = require('assert');
var NamedObject = require('../namedobject');
var Gang = require('../gang');

function createNamedObject(_uName, _owner) {
   var name = _uName;

   if (_owner && (typeof _uName === "string") && (_uName[0] === ":")) {
      name = _uName.split(":").pop();
   }

   return new NamedObject({ name: name, type: "namedobject" }, _owner);
}

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

runTest("builds single-colon uNames from root", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var room = new NamedObject({ name: "room", type: "namedobject" }, root);
   var lamp = new NamedObject({ name: "lamp", type: "namedobject" }, room);

   assert.strictEqual(root.uName, ":");
   assert.strictEqual(room.uName, ":room");
   assert.strictEqual(lamp.uName, ":room:lamp");
});

runTest("resolves absolute-name child ownership with single-colon form", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var room = new NamedObject({ name: "room", type: "namedobject" }, root);
   var lamp = new NamedObject({ name: ":room:lamp", type: "namedobject" }, root);

   assert.strictEqual(lamp.owner, room);
   assert.strictEqual(lamp.name, "lamp");
   assert.strictEqual(lamp.uName, ":room:lamp");
});

runTest("finds objects by single-colon absolute path", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var room = new NamedObject({ name: "room", type: "namedobject" }, root);
   var lamp = new NamedObject({ name: "lamp", type: "namedobject" }, room);

   assert.strictEqual(root.findNamedObject(":room"), room);
   assert.strictEqual(root.findNamedObject(":room:lamp"), lamp);
   assert.strictEqual(root.findNamedObject("::room"), null);
});

runTest("findOwner resolves the nearest existing owner", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var room = new NamedObject({ name: "room", type: "namedobject" }, root);
   var lamp = new NamedObject({ name: "lamp", type: "namedobject" }, room);

   assert.strictEqual(root.findOwner(":room:lamp:brightness"), lamp);
   assert.strictEqual(root.findOwner(":room:unknown:brightness"), room);
   assert.strictEqual(root.findOwner(":room"), root);
});

runTest("create and findOrCreate use single-colon names", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var created = root.findOrCreate(":kitchen:ceiling", createNamedObject);

   assert.ok(created);
   assert.strictEqual(created.uName, ":kitchen:ceiling");
   assert.strictEqual(root.findNamedObject(":kitchen:ceiling"), created);
});

runTest("renaming an owner updates descendant uNames", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   var room = new NamedObject({ name: "room", type: "namedobject" }, root);
   var lamp = new NamedObject({ name: "lamp", type: "namedobject" }, room);

   room.setName("kitchen");

   assert.strictEqual(room.uName, ":kitchen");
   assert.strictEqual(lamp.uName, ":kitchen:lamp");
   assert.strictEqual(root.findNamedObject(":kitchen:lamp"), lamp);
});

runTest("filterName emits single-colon scope hits", function() {
   var root = new NamedObject({ name: "root", type: "namedobject" });
   new NamedObject({ name: "room", type: "namedobject" }, root);
   new NamedObject({ name: "robot", type: "namedobject" }, root);

   var result = root.filterName(":ro");
   assert.ok(result.hits.indexOf(":room:") !== -1);
   assert.ok(result.hits.indexOf(":robot:") !== -1);
});

runTest("Gang validateUName accepts single-colon and rejects double-colon", function() {
   assert.strictEqual(Gang.prototype.validateUName.call({}, ":"), ":");
   assert.strictEqual(Gang.prototype.validateUName.call({}, ":room"), ":room");
   assert.strictEqual(Gang.prototype.validateUName.call({}, "thing:room"), "thing:room");

   assert.throws(function() {
      Gang.prototype.validateUName.call({}, "::room");
   }, /Double-colon global scope is no longer supported/);
});

process.stdout.write("All namedobject phase 2 tests passed.\n");
