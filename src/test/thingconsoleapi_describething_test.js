var assert = require('assert');
var ThingConsoleApi = require('../consoleapis/thingconsoleapi');

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

runTest("describeThing reports object, relation and member propagation", function() {
   var parentThing = {
      uName: ":building",
      name: "building",
      type: "building",
      topLevelThing: true,
      ignoreChildren: false,
      propagateToChildren: true,
      superType: function() { return "thing"; },
      getCasa: function() { return { name: "casa-a" }; }
   };

   var childThing = {
      uName: ":building:room",
      name: "room",
      type: "room",
      owner: parentThing,
      ignoreParent: false,
      propagateToParent: true,
      superType: function() { return "thing"; },
      getCasa: function() { return { name: "casa-a" }; }
   };

   var thing = {
      uName: ":building:bedroom",
      name: "bedroom",
      type: "bedroom",
      owner: parentThing,
      topLevelThing: false,
      local: true,
      fromPeer: false,
      bowing: false,
      priority: 10,
      ignoreParent: false,
      ignoreChildren: true,
      propagateToParent: true,
      propagateToChildren: false,
      things: { room: childThing },
      properties: {
         MOVEMENT: {
            uName: ":building:bedroom:MOVEMENT",
            name: "MOVEMENT",
            type: "property",
            local: true,
            valid: true,
            cold: false,
            value: true,
            config: { parentInherited: true },
            sourceListeners: { a: {}, b: {} },
            ignoreChildren: false
         }
      },
      events: {
         alarm: {
            uName: ":building:bedroom:alarm",
            name: "alarm",
            type: "event",
            local: false,
            cold: false,
            value: true,
            config: { childInherited: true },
            sourceListeners: {},
            propagateToChildren: true
         }
      },
      superType: function() { return "thing"; },
      getCasa: function() { return { name: "casa-a" }; }
   };

   var apiContext = {
      checkParams: function() {},
      myObj: function() { return thing; }
   };

   ThingConsoleApi.prototype.describeThing.call(apiContext, null, [], function(_err, _result) {
      assert.ifError(_err);
      assert.strictEqual(_result.thing.object.uName, ":building:bedroom");
      assert.strictEqual(_result.parent.object.uName, ":building");
      assert.strictEqual(_result.propagation.effective.receivesFromParent, true);
      assert.strictEqual(_result.propagation.effective.receivesFromChildren, false);
      assert.strictEqual(_result.children.length, 1);
      assert.strictEqual(_result.children[0].propagation.receivesFromParent, false);
      assert.strictEqual(_result.properties[0].inherited.parent, true);
      assert.strictEqual(_result.properties[0].propagation.effective.ignoreChildren, false);
      assert.strictEqual(_result.properties[0].sourceListenerCount, 2);
      assert.strictEqual(_result.events[0].inherited.child, true);
      assert.strictEqual(_result.events[0].propagation.effective.propagateToChildren, true);
      assert.strictEqual(_result.inheritance.properties.parent.length, 1);
      assert.strictEqual(_result.inheritance.events.child.length, 1);
      assert.strictEqual(_result.inheritance.properties.local.length, 0);
   });
});

runTest("describeThing reports blocked child inheritance candidates", function() {
   var blockedChild = {
      uName: ":building:room",
      name: "room",
      type: "room",
      owner: null,
      ignoreParent: false,
      propagateToParent: false,
      properties: {
         TEMPERATURE: {
            uName: ":building:room:TEMPERATURE",
            name: "TEMPERATURE",
            type: "property",
            config: {}
         }
      },
      events: {
         occupancy: {
            uName: ":building:room:occupancy",
            name: "occupancy",
            type: "event",
            config: {}
         }
      },
      superType: function() { return "thing"; },
      getCasa: function() { return { name: "casa-a" }; }
   };

   var thing = {
      uName: ":building",
      name: "building",
      type: "building",
      owner: null,
      topLevelThing: true,
      local: true,
      fromPeer: false,
      bowing: false,
      priority: 0,
      ignoreParent: false,
      ignoreChildren: false,
      propagateToParent: true,
      propagateToChildren: true,
      things: { room: blockedChild },
      properties: {},
      events: {},
      superType: function() { return "thing"; },
      getCasa: function() { return { name: "casa-a" }; }
   };

   blockedChild.owner = thing;

   var apiContext = {
      checkParams: function() {},
      myObj: function() { return thing; }
   };

   ThingConsoleApi.prototype.describeThing.call(apiContext, null, [], function(_err, _result) {
      assert.ifError(_err);
      assert.strictEqual(_result.inheritance.blocked.fromChildren.properties.length, 1);
      assert.strictEqual(_result.inheritance.blocked.fromChildren.properties[0].name, "TEMPERATURE");
      assert.strictEqual(_result.inheritance.blocked.fromChildren.properties[0].viaThingName, "room");
      assert.strictEqual(_result.inheritance.blocked.fromChildren.events.length, 1);
      assert.strictEqual(_result.inheritance.blocked.fromChildren.events[0].name, "occupancy");
   });
});

process.stdout.write("All thingconsoleapi describeThing tests passed.\n");
