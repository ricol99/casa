var assert = require('assert');
var ConsoleApiService = require('../services/consoleapiservice');

function runAsyncTest(_name, _fn) {
   _fn(function(_err) {

      if (_err) {
         process.stderr.write("[FAIL] " + _name + "\n");
         process.stderr.write((_err && _err.stack) ? _err.stack : (_err + "\n"));
         process.exit(1);
      }

      process.stdout.write("[PASS] " + _name + "\n");
   });
}

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
            throw new Error("No handler registered for event " + _event);
         }

         handlers[_event](_payload);
      }
   };
}

runAsyncTest("executeCommand streams preview progress via output before final execute-output", function(_done) {
   var ConsoleApiSession = ConsoleApiService.__testExports.ConsoleApiSession;
   var socket = createFakeSocket();
   function FakeGangConsoleApi() {}

   FakeGangConsoleApi.prototype.previewConfig = function(_session, _params, _callback) {
      var options = (_params && _params.length > 0) ? _params[0] : {};

      if (options && options.progress) {
         this.consoleApiService.writeOutput(_session.name, {
            type: "previewConfigProgress",
            scope: "gang",
            targetCasa: "casa-test",
            progress: { event: "preview-started", total: 2, processed: 0, percent: 0 }
         });
         this.consoleApiService.writeOutput(_session.name, {
            type: "previewConfigProgress",
            scope: "gang",
            targetCasa: "casa-test",
            progress: { event: "preview-progress", total: 2, processed: 1, percent: 50 }
         });
         this.consoleApiService.writeOutput(_session.name, {
            type: "previewConfigProgress",
            scope: "gang",
            targetCasa: "casa-test",
            progress: { event: "preview-complete", total: 2, processed: 2, percent: 100, changedSourceCount: 1 }
         });
      }

      return _callback(null, { ok: true, summary: { changedSourceCount: 1 } });
   };

   FakeGangConsoleApi.prototype.sessionClosed = function() {};

   var owner = {
      sessions: {},
      uName: ":console-api-service-test",
      gang: {
         findNamedObject: function(_uName) {
            return (_uName === ":gang") ? { uName: _uName } : null;
         }
      },
      findOrCreateConsoleApiObject: function() {
         return apiObject;
      },
      writeOutput: function(_sessionId, _output) {

         if (this.sessions.hasOwnProperty(_sessionId)) {
            this.sessions[_sessionId].writeOutput(_output);
         }
      }
   };
   var apiObject = new FakeGangConsoleApi();
   apiObject.uName = ":gang";
   apiObject.consoleApiService = owner;

   var session = new ConsoleApiSession("test-session", null, owner);
   owner.sessions[session.name] = session;
   session.serveClient(socket);

   socket.trigger("executeCommand", { obj: ":gang", method: "previewConfig", arguments: [ { progress: true } ] });

   setImmediate(function() {
      try {
         var outputs = socket.emissions.filter( (_item) => _item.event === "output" );
         var executeOutputs = socket.emissions.filter( (_item) => _item.event === "execute-output" );

         assert.strictEqual(outputs.length, 3);
         assert.strictEqual(executeOutputs.length, 1);
         assert.strictEqual(outputs[0].payload.result.progress.event, "preview-started");
         assert.strictEqual(outputs[1].payload.result.progress.event, "preview-progress");
         assert.strictEqual(outputs[2].payload.result.progress.event, "preview-complete");
         assert.strictEqual(executeOutputs[0].payload.result.ok, true);

         var lastOutputIndex = -1;
         var executeOutputIndex = -1;

         for (var i = 0; i < socket.emissions.length; ++i) {

            if (socket.emissions[i].event === "output") {
               lastOutputIndex = i;
            }
            else if (socket.emissions[i].event === "execute-output") {
               executeOutputIndex = i;
               break;
            }
         }

         assert.ok((lastOutputIndex !== -1) && (executeOutputIndex !== -1));
         assert.ok(lastOutputIndex < executeOutputIndex);
      }
      catch (_err) {
         return _done(_err);
      }

      _done();
   });
});
