var util = require('util');
var Gang = require('./gang');
var Console = require('./console');

function LocalConsole() {
   this.gang = Gang.mainInstance();
   this.uName = "localconsole:"+Date.now();

   this.consoleApiService =  this.gang.findService("service:consoleapi");
   this.gangApi = this.consoleApiService.getGangConsoleApi();

   this.consoleApiSession = this.consoleApiService.getSession(this.uName, this);

   Console.call(this, { name: this.gang.casa.uName });
}

util.inherits(LocalConsole, Console);

LocalConsole.prototype.scopeExists = function(_scope, _callback) {
   this.consoleApiSession.scopeExists({ scope: _scope }, _callback);
};

LocalConsole.prototype.autoComplete = function(_input, _callback) {
   this.consoleApiSession.completeLine(_input, _callback);
};

LocalConsole.prototype.executeCommand = function(_command, _callback) {
   this.consoleApiSession.executeCommand(_command, _callback);
};

module.exports = exports = LocalConsole;
 
