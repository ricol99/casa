var assert = require('assert');
var Gang = require('../gang');
var NamedObject = require('../namedobject');
var TopProperty = require('../properties/topproperty');

var originalMainInstance = Gang.mainInstance;
var gang = {
   name: 'local',
   validateUName: Gang.prototype.validateUName,
   casa: { addSourceListener: function() {} }
};
Gang.mainInstance = function() { return gang; };

try {
   var owner = new NamedObject({ name: 'room', type: 'thing' }, ':room');
   var property = new TopProperty({
      name: 'selected', valueType: 'number', sources: [
         { uName: ':sensor', property: 'primary' },
         { uName: ':sensor', property: 'backup' },
         { uName: ':sensor', property: 'primary', gang: 'remote' }
      ]
   }, owner);
   assert.strictEqual(property.sources.length, 3);
   assert.strictEqual(new Set(property.sources).size, 3);
   property.sources.forEach(function(listener, index) {
      assert.ok(listener, 'configured source must resolve to its listener');
      listener.valid = true;
      listener.isValid = function() { return this.valid; };
      listener.sourcePropertyValue = index + 10;
   });
   assert.strictEqual(property.calculateOutputValue(), 10);
   property.sources[0].valid = false;
   assert.strictEqual(property.calculateOutputValue(), 11);
   property.sources[1].valid = false;
   assert.strictEqual(property.calculateOutputValue(), 12);
   property.sources[2].valid = false;
   assert.strictEqual(property.calculateOutputValue(), false);

   var singular = new TopProperty({
      name: 'single', valueType: 'number',
      source: { property: 'temperature', gang: 'local', value: 20 }
   }, owner);
   assert.strictEqual(singular.sources.length, 1);
   assert.strictEqual(singular.sources[0], singular.sourceListeners[':room:temperature:20']);
   assert.ok(singular.sources[0]);
   process.stdout.write('[PASS] top property listener identity, order, validity and singular source\n');
} finally {
   Gang.mainInstance = originalMainInstance;
}
