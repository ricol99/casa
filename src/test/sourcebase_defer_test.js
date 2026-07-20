var assert = require('assert');
var SourceBase = require('../sourcebase');

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

function withCapturedConsoleError(_fn) {
   var originalConsoleError = console.error;
   var errors = [];

   console.error = function(_message) {
      errors.push(String(_message));
   };

   try {
      _fn(errors);
   }
   finally {
      console.error = originalConsoleError;
   }
}

runTest("non-local source defers to higher priority peer", function() {
   var source = { uName: ":shared", local: false, priority: 1 };
   var peer = { uName: ":shared", fromPeer: true, type: "peersource", priority: 2 };

   assert.strictEqual(SourceBase.prototype.deferToPeer.call(source, peer), true);
});

runTest("non-local source does not defer to lower priority peer", function() {
   var source = { uName: ":shared", local: false, priority: 5 };
   var peer = { uName: ":shared", fromPeer: true, type: "peersource", priority: 2 };

   assert.strictEqual(SourceBase.prototype.deferToPeer.call(source, peer), false);
});

runTest("local source defers to peer regardless of priority and logs error", function() {
   var source = { uName: ":shared", local: true, priority: 10 };
   var peer = { uName: ":shared", fromPeer: true, type: "peersource", priority: 1 };

   withCapturedConsoleError(function(_errors) {
      assert.strictEqual(SourceBase.prototype.deferToPeer.call(source, peer), true);
      assert.strictEqual(_errors.length, 1);
      assert.ok(_errors[0].indexOf("Local source cannot override global shared source") !== -1);
   });
});

process.stdout.write("All sourcebase defer tests passed.\n");
