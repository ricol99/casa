var util = require('util');
var Gang = require('./gang');
var Console = require('./console');

function LocalConsole() {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.uName = "localconsole:"+Date.now();

   this.consoleApiService =  this.casa.findService("consoleapiservice");
   this.consoleApiSession = this.consoleApiService.getSession(this.uName, this);

   Console.call(this, { name: this.casa.uName });
}

util.inherits(LocalConsole, Console);

LocalConsole.prototype.scopeExists = function(_line, _callback) {
   this.consoleApiSession.scopeExists({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.autoComplete = function(_line, _callback) {
   this.consoleApiSession.completeLine({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.executeCommand = function(_line, _callback) {
   this.consoleApiSession.executeCommand({ scope: this.currentScope, line: _line }, _callback);
};

module.exports = exports = LocalConsole;
 
