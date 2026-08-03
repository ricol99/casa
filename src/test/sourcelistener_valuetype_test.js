var assert = require('assert');
var CombineStateProperty = require('../properties/combinestateproperty');
var EdgeProperty = require('../properties/edgeproperty');
var Property = require('../property');
var QuantiseProperty = require('../properties/quantiseproperty');
var SourceListener = require('../sourcelistener');
var StateProperty = require('../properties/stateproperty');

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

function createEventListener(_valueType) {
   var checkCalls = 0;
   var source = {
      uName: ":event-source",
      bowing: false,
      bound: [],
      on: function(_event, _handler, _subscription) {
         this.bound.push({ event: _event, handler: _handler, subscription: _subscription });
      }
   };

   var listener = Object.create(SourceListener.prototype);
   listener.uName = ":target:listener";
   listener.sourceName = source.uName;
   listener.listeningToPropertyChange = false;
   listener.capturingAllEvents = false;
   listener.subscription = { event: "knock" };
   listener.outputValues = {};
   listener.listening = false;
   listener.gang = {
      findNamedObject: function(_uName) {
         assert.strictEqual(_uName, source.uName);
         return source;
      }
   };
   listener.owner = {
      checkSourceListenerValueType: function(_sourceListener) {
         checkCalls = checkCalls + 1;
         assert.strictEqual(_sourceListener.getValueType(), _valueType);
      }
   };

   if (_valueType) {
      listener.valueType = _valueType;
   }

   return {
      listener: listener,
      source: source,
      getCheckCalls: function() {
         return checkCalls;
      }
   };
}

runTest("event source listener without valueType does not run property valueType check", function() {
   var harness = createEventListener();

   assert.strictEqual(harness.listener.establishListeners(), true);
   assert.strictEqual(harness.getCheckCalls(), 0);
   assert.strictEqual(harness.source.bound[0].event, "event-raised");
});

runTest("event source listener with valueType still runs property valueType check", function() {
   var harness = createEventListener("boolean");

   assert.strictEqual(harness.listener.establishListeners(), true);
   assert.strictEqual(harness.getCheckCalls(), 1);
});

runTest("property valueType mismatch logs instead of throwing", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(Property.prototype);
   property.uName = ":target:level";
   property.valueType = "number";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         sourceEventName: ":source:active",
         getValueType: function() {
            return "boolean";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 1);
   assert(errors[0].includes("does not match property valueType"));
});

runTest("state-owned stateproperty listener skips valueType check", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(StateProperty.prototype);
   property.uName = ":target:state";
   property.valueType = "string";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         stateOwned: true,
         sourceEventName: ":target:active",
         getValueType: function() {
            return "boolean";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 0);
});

runTest("property-level stateproperty listener still checks valueType", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(StateProperty.prototype);
   property.uName = ":target:state";
   property.valueType = "string";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         sourceEventName: ":target:active",
         getValueType: function() {
            return "boolean";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 1);
   assert(errors[0].includes("does not match property valueType"));
});

runTest("edgeproperty skips valueType check", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(EdgeProperty.prototype);
   property.uName = ":target:edge";
   property.valueType = "string";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         sourceEventName: ":source:active",
         getValueType: function() {
            return "boolean";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 0);
});

runTest("quantiseproperty skips valueType check", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(QuantiseProperty.prototype);
   property.uName = ":target:bucket";
   property.valueType = "string";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         sourceEventName: ":source:level",
         getValueType: function() {
            return "number";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 0);
});

runTest("combinestateproperty skips valueType check", function() {
   var errors = [];
   var oldConsoleError = console.error;
   var property = Object.create(CombineStateProperty.prototype);
   property.uName = ":target:combined-state";
   property.valueType = "string";

   try {
      console.error = function(_message) {
         errors.push(_message);
      };

      property.checkSourceListenerValueType({
         sourceEventName: ":source:active",
         getValueType: function() {
            return "boolean";
         }
      });
   }
   finally {
      console.error = oldConsoleError;
   }

   assert.strictEqual(errors.length, 0);
});
