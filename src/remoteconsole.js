var crypto = require('crypto');
var readline = require('readline');
var io = require('socket.io-client');
var util = require('./util');

function RemoteConsole(_params) {
   this.secureMode = _params.secureMode;
   this.certPath = _params.certPath;
   this.name = _params.name;
   this.host = _params.host;
   this.port = _params.port;

   if (this.secureMode) {
      var fs = require('fs');
      this.http = "https";
      this.socketOptions = {
         secure: true,
         rejectUnauthorized: false,
         key: fs.readFileSync(this.certPath+'/client.key'),
         cert: fs.readFileSync(this.certPath+'/client.crt'),
         ca: fs.readFileSync(this.certPath+'/ca.crt'),
         json: true
      };
   }
   else {
      this.http = "http";
      this.socketOptions = { transports: ['websocket'], json: true };
   }

   this.autoCompleteHandler = RemoteConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = RemoteConsole.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler,
     prompt: this.name+' > '
   });

   this.establishSocket();

   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
}

RemoteConsole.prototype.establishSocket = function() {
   this.socket = io(this.http + '://' + this.host + ':' + this.port + '/console/io', this.socketOptions);

   this.socket.on('connect', (_data) => {
       this.rl.prompt();
   });

   this.socket.on('connect_error', (_data) => {
      process.stdout.write(util.inspect(_data) +"\n");
      process.exit(1);
   });

   this.socket.on('output', (_data) => {
      process.stdout.write("\n" + this.processOutput(_data.result) + "\n" + this.name + " > ");
   });

   this.socket.on('complete-output', (_data) => {

      if (this.completeCallback) {
         this.completeCallback(null, _data.result, this.completeLine);
      }
   });

   this.socket.on('execute-output', (_data) => {
      process.stdout.write(this.processOutput(_data.result) + "\n");
      this.rl.prompt();
   });

   this.socket.on('disconnect', (_data) => {
      process.stdout.write("\nCasa disconnected. Exiting..\n");
      process.exit(1);
   });

   this.socket.on('error', (_data) => {
      process.stdout.write("\nCasa disconnected. Exiting..\n");
      process.exit(1);
   });
};

RemoteConsole.prototype.autoCompleteCb = function(_line, _callback) {
   this.completeCallback = _callback;
   this.completeLine = _line;

   this.socket.emit('completeLine', { line: _line });
};

RemoteConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   if (_line !== "") {
      var command = {};
      var dotSplit = _line.split(".");
      command.scope = dotSplit[0].split(":");

      if (_line.indexOf(".") !== -1) {
         var str = _line.split(".").slice(1).join(".");
         command.method  = str.split("(")[0];
         var methodArguments = str.split("(").slice(1).join("(").trim();
         var i;

         for (i = methodArguments.length-1; i >= 0; --i) {

            if (methodArguments.charAt(i) == ')') {
               break;
            }
         }
         if (i !== 0) {
            methodArguments = methodArguments.substring(0, i);
            command.arguments = JSON.parse("["+methodArguments+"]");
         }
         else {
            command.arguments = [];
         }

         if (!command.arguments) {
            process.stdout.write("Unable to parse arguments!\n");
            this.rl.prompt();
            return;
         }
      }

      this.socket.emit('executeCommand', { command: command });
   }
   else {
      this.rl.prompt();
   }
};

RemoteConsole.prototype.processOutput = function(_outputOfEvaluation) {

   if (_outputOfEvaluation !== undefined) {

      if (typeof _outputOfEvaluation === 'object' || _outputOfEvaluation instanceof Array) {
         return util.inspect(_outputOfEvaluation);
      }
      else {
         return _outputOfEvaluation.toString();
      }
   }
   else {
      return _outputOfEvaluation;
   }
};

module.exports = exports = RemoteConsole;

