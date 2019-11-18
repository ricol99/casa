var crypto = require('crypto');
var readline = require('readline');
var request = require('request');

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
      this.socketOptions = { json: true };
   }

   this.autoCompleteHandler = RemoteConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = RemoteConsole.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler,
     prompt: this.name+' > '
   });

   this.rl.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
}

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

   request(this.http + "://" + this.host + ":" + this.port + "/console/executeLine/" + _line, this.socketOptions, (_err, _res, _body) => {

      if (_err || _body.hasOwnProperty("error")) {
         process.stdout.write(_err ? _err : _body.error);
      }
      else {
         process.stdout.write(_body + "\n");
      }

      this.rl.prompt();
   });
};

module.exports = exports = RemoteConsole;

