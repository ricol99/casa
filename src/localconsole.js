var readline = require('readline');
var util = require('util');
var Gang = require('./gang');

function LocalConsole() {
   this.gang = Gang.mainInstance();
   this.uName = "localconsole:"+Date.now();

   this.consoleService =  this.gang.findService("consoleservice");
   this.gangConsole = this.consoleService.getGangConsole();

   this.consoleSession = this.consoleService.getSession(this.uName, this);

   this.autoCompleteHandler = LocalConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = LocalConsole.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler,
     prompt: 'casa > '
   });

   this.rl.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
}

LocalConsole.prototype.autoCompleteCb = function(_line) {
   return this.consoleSession.completeLine(_line);
};

LocalConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   if (_line !== "") {
      process.stdout.write(this.consoleSession.executeLine(_line)+"\n");
   }
   this.rl.prompt();
};

LocalConsole.prototype.writeOutput = function(_line) {
   process.stdout.write("\n" + _line + "\ncasa > ");
};

module.exports = exports = LocalConsole;
 
