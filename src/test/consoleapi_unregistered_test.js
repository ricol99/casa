var assert = require('assert');
var ConsoleApiService = require('../services/consoleapiservice');

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

function createSocket() {
   return {
      handlers: {},
      emissions: [],
      on: function(_event, _handler) {
         this.handlers[_event] = _handler;
      },
      emit: function(_event, _data) {
         this.emissions.push({ event: _event, data: _data });
      },
      trigger: function(_event, _data) {
         this.handlers[_event](_data);
      }
   };
}

runTest("console api getCasaInfo tolerates missing dbs", function() {
   var ConsoleApiSession = ConsoleApiService.__testExports.ConsoleApiSession;
   var socket = createSocket();
   var session = new ConsoleApiSession("test-session", null, {
      gang: {
         name: "unregistered",
         getDb: function() {
            return null;
         },
         casa: {
            getDb: function() {
               return null;
            }
         }
      }
   });

   session.serveClient(socket);
   socket.trigger("getCasaInfo", {});

   assert.deepStrictEqual(socket.emissions[0], {
      event: "casa-info",
      data: {
         dbInfo: null,
         gangDbInfo: null
      }
   });
});

process.stdout.write("All consoleapi unregistered tests passed.\n");
