var assert = require('assert');
var Property = require('../property');
var PeerSource = require('../peersource');
var Source = require('../source');

var peer = Object.create(PeerSource.prototype);
peer.uName = ':peer';
peer.properties = {};
peer.checkTransaction = function() { return 1; };
peer.setTransaction = function() {};
peer.ensurePropertyExists = function() { return false; };
var notifications = [];
peer.asyncEmit = function(event, data) { notifications.push(data); };
peer.propertyGoneInvalid = function() { throw new Error('Must not introduce invalidation events'); };
var property = Object.create(Property.prototype);
Object.assign(property, { owner: peer, name: 'present', uName: ':peer:present', value: true,
   valid: false, cold: false, valueType: 'boolean', sourceListeners: {} });
property.cancelCurrentRamp = function() {};
peer.properties.present = property;

function receive(value, valid) {
   var data = { name: 'present', value: value, valueType: 'boolean', transaction: 1 };
   if (valid !== undefined) data.valid = valid;
   peer.sourceHasChangedProperty(JSON.parse(JSON.stringify(data)));
}
receive(true, true);
assert.strictEqual(property.valid, true);
receive(true, false);
assert.strictEqual(property.valid, false);
receive(true, true);
assert.strictEqual(property.valid, true);
assert.strictEqual(notifications.length, 0, 'same-value metadata updates must not emit events');
receive(false, false);
assert.strictEqual(property.value, false);
assert.strictEqual(property.valid, false);
assert.strictEqual(notifications.length, 1, 'changed values retain their ordinary notification');
receive(true);
assert.strictEqual(property.valid, false, 'older messages must preserve validity');
receive(true, 'true');
assert.strictEqual(property.valid, false, 'only Boolean owner metadata applies');

var source = Object.create(Source.prototype);
source.uName = ':owner';
source.properties = { present: property };
source.checkTransaction = function() { return 1; };
source.propertyAboutToChange = function() {};
source.casa = { eventLogger: { logRaisedEvent: function() {} } };
var sent;
source.asyncEmit = function(event, data) { sent = data; };
[false, true].forEach(function(valid) {
   property.valid = valid;
   source.updateProperty('present', !property.value, { valid: !valid });
   assert.strictEqual(sent.valid, valid, 'outgoing validity comes from the owner, not caller data');
});
console.log('[PASS] Owner validity metadata, equal-value peer updates, unchanged notification behaviour and legacy messages');
