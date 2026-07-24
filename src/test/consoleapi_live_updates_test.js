var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var ConsoleApiService = require('../services/consoleapiservice');

function createFakeSocket() {
   var handlers = {};
   var emissions = [];

   return {
      handlers: handlers,
      emissions: emissions,
      on: function(_event, _handler) {
         handlers[_event] = _handler;
      },
      emit: function(_event, _payload) {
         emissions.push({ event: _event, payload: _payload });
      },
      trigger: function(_event, _payload) {

         if (!handlers[_event]) {
            throw new Error('No handler registered for event ' + _event);
         }

         handlers[_event](_payload);
      }
   };
}

function createSession(_casa) {
   var ConsoleApiSession = ConsoleApiService.__testExports.ConsoleApiSession;
   var owner = {
      sessions: {},
      uName: ':console-api-service-test',
      gang: {
         casa: _casa
      }
   };
   var socket = createFakeSocket();
   var session = new ConsoleApiSession('test-session-' + Date.now(), null, owner);
   owner.sessions[session.name] = session;
   session.serveClient(socket);
   return {
      owner: owner,
      socket: socket,
      session: session
   };
}

function liveUpdateEmissions(_socket) {
   return _socket.emissions.filter(function(_item) {
      return _item.event === 'live-update';
   });
}

function subscriptionEmissions(_socket) {
   return _socket.emissions.filter(function(_item) {
      return _item.event === 'live-update-subscription';
   });
}

function runTest(_name, _fn) {

   try {
      _fn();
      process.stdout.write('[PASS] ' + _name + '\n');
   }
   catch (_err) {
      process.stderr.write('[FAIL] ' + _name + '\n');
      process.stderr.write((_err && _err.stack) ? _err.stack : (_err + '\n'));
      process.exit(1);
   }
}

runTest('console socket forwards subscribed property and event updates', function() {
   var casa = new EventEmitter();
   var fixture = createSession(casa);
   var propertyEvent = {
      sourceName: ':thing:lamp',
      name: 'power',
      value: true,
      propertyOldValue: false,
      transaction: 12
   };
   var eventRaised = {
      sourceName: ':thing:lamp',
      name: 'button-pressed',
      value: true,
      transaction: 13
   };

   fixture.socket.trigger('subscribeLiveUpdates', {});

   assert.strictEqual(casa.listeners('source-property-changed').length, 1);
   assert.strictEqual(casa.listeners('source-event-raised').length, 1);
   assert.deepStrictEqual(subscriptionEmissions(fixture.socket)[0].payload, { subscribed: true });

   casa.emit('source-property-changed', propertyEvent);
   casa.emit('source-event-raised', eventRaised);

   var updates = liveUpdateEmissions(fixture.socket);
   assert.strictEqual(updates.length, 2);
   assert.strictEqual(updates[0].payload.type, 'source-property-changed');
   assert.deepStrictEqual(updates[0].payload.data, propertyEvent);
   assert.strictEqual(updates[1].payload.type, 'source-event-raised');
   assert.deepStrictEqual(updates[1].payload.data, eventRaised);

   fixture.socket.trigger('unsubscribeLiveUpdates', {});
   assert.strictEqual(casa.listeners('source-property-changed').length, 0);
   assert.strictEqual(casa.listeners('source-event-raised').length, 0);
   assert.deepStrictEqual(subscriptionEmissions(fixture.socket)[1].payload, { subscribed: false });

   casa.emit('source-property-changed', {
      sourceName: ':thing:lamp',
      name: 'power',
      value: false
   });
   assert.strictEqual(liveUpdateEmissions(fixture.socket).length, 2);
});

runTest('console socket live update listeners are removed when the session closes', function() {
   var casa = new EventEmitter();
   var fixture = createSession(casa);

   fixture.socket.trigger('subscribeLiveUpdates', {});
   assert.strictEqual(casa.listeners('source-property-changed').length, 1);
   assert.strictEqual(casa.listeners('source-event-raised').length, 1);

   fixture.session.sessionClosed();

   assert.strictEqual(casa.listeners('source-property-changed').length, 0);
   assert.strictEqual(casa.listeners('source-event-raised').length, 0);
   assert.ok(!fixture.owner.sessions.hasOwnProperty(fixture.session.name));

   casa.emit('source-event-raised', {
      sourceName: ':thing:lamp',
      name: 'button-pressed'
   });
   assert.strictEqual(liveUpdateEmissions(fixture.socket).length, 0);
});
