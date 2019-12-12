var crypto = require('crypto');
var readline = require('readline');
var io = require('socket.io-client');
var util = require('./util');
var Console = require('./console');

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

   Console.call(this, { name: this.name });

   this.establishSocket();
}

util.inherits(RemoteConsole, Console);

RemoteConsole.prototype.establishSocket = function() {
   this.socket = io(this.http + '://' + this.host + ':' + this.port + '/consoleapi/io', this.socketOptions);

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

   this.socket.on('scope-exists-output', (_data) => {

      if (this.scopeExistsCallback) {
         this.scopeExistsCallback(null, _data);
      }
   });

   this.socket.on('complete-output', (_data) => {

      if (this.completeCallback) {
         this.completeCallback(null, _data.result, this.completeLine);
      }
   });

   this.socket.on('execute-output', (_data) => {
      if (this.executeCallback) {
         this.executeCallback(null, _data.result);
      }
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

RemoteConsole.prototype.scopeExists = function(_line, _callback) {
   this.scopeExistsCallback = _callback;
   this.socket.emit('scopeExists', { scope: this.currentScope, line: _line });
};

RemoteConsole.prototype.autoComplete = function(_line, _callback) {
   this.completeCallback = _callback;
   this.completeLine = _line;

   this.socket.emit('completeLine', { scope: this.currentScope, line: _line });
};

RemoteConsole.prototype.executeCommand = function(_line, _callback) {
   this.executeCallback = _callback;
   this.socket.emit('executeCommand', { scope: this.currentScope, line: _line });
};

module.exports = exports = RemoteConsole;

