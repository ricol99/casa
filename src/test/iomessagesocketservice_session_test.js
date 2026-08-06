var assert = require('assert');
var IoMessageSocketService = require('../services/iomessagesocketservice');

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

function createHarness() {
   var service = Object.create(IoMessageSocketService.prototype);
   var sent = [];

   service.gang = {
      casa: {
         uName: ":local"
      }
   };
   service.nextLocalSocketId = 0;

   var transport = {
      sockets: {},
      getName: function() {
         return "pusher";
      },
      addSocket: function(_socket) {
         this.sockets[_socket.getId()] = _socket;
      },
      deleteSocket: function(_socket) {
         delete this.sockets[_socket.getId()];
      },
      sendMessage: function(_message, _data) {
         sent.push({ message: _message, data: _data });
      }
   };

   service.deleteSocket = function(_socket) {
      _socket.getMessageTransport().deleteSocket(_socket);
   };

   return {
      IoMessageSocket: IoMessageSocketService.__testExports.IoMessageSocket,
      sent: sent,
      service: service,
      transport: transport
   };
}

runTest("pusher transport sockets get distinct ids within the same millisecond", function() {
   var harness = createHarness();
   var originalDateNow = Date.now;

   Date.now = function() {
      return 12345;
   };

   try {
      var socketA = new harness.IoMessageSocket(harness.service, harness.transport);
      var socketB = new harness.IoMessageSocket(harness.service, harness.transport);

      assert.notStrictEqual(socketA.getId(), socketB.getId());
      assert.ok(socketA.getId().indexOf(":local") !== -1);
      assert.ok(socketB.getId().indexOf(":local") !== -1);
   }
   finally {
      Date.now = originalDateNow;
   }
});

runTest("sockets are removed from the transport table after normal disconnect", function() {
   var harness = createHarness();
   var socket = new harness.IoMessageSocket(harness.service, harness.transport);

   socket.connect(":remote", "/consoleapi/io", { heartbeat: 0 });
   assert.ok(harness.transport.sockets.hasOwnProperty(socket.getId()));

   socket.receivedConnectRespFromTransport({ messageData: { accept: true } });
   socket.disconnect();
   socket.receivedDisconnectRespFromTransport({});

   assert.strictEqual(harness.transport.sockets.hasOwnProperty(socket.getId()), false);
});

runTest("sockets are removed from the transport table when the peer disconnects", function() {
   var harness = createHarness();
   var socket = new harness.IoMessageSocket(harness.service, harness.transport);

   socket.connect(":remote", "/consoleapi/io", { heartbeat: 0 });
   socket.receivedConnectRespFromTransport({ messageData: { accept: true } });
   socket.receivedDisconnectFromTransport({});

   assert.strictEqual(harness.transport.sockets.hasOwnProperty(socket.getId()), false);
});
