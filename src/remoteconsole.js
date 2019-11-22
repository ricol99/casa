var crypto = require('crypto');
var readline = require('readline');
var io = require('socket.io-client');
var request = require('request');
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
      process.stdout.write("\n" + _data.line + "\n" + this.name + " > ");
   });

   this.socket.on('execute-output', (_data) => {
      process.stdout.write(_data.line + "\n");
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
   request(this.http + "://" + this.host + ":" + this.port + "/console/completeLine/" + _line, this.socketOptions, (_err, _res, _body) => {

      if (_err || _body.hasOwnProperty("error")) {
         return _callback(_err ? _err : _body.error);
      }

      _callback(null, _body, _line);
   });
};

RemoteConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   if (_line !== "") {
      this.socket.emit('executeLine', { line: _line });
   }
   else {
      this.rl.prompt();
   }
};

module.exports = exports = RemoteConsole;

