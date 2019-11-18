var readline = require('readline');
var util = require('util');
var Gang = require('./gang');

function LocalConsole() {
   this.gang = Gang.mainInstance();

   this.consoleService =  this.gang.findService("consoleservice");
   this.gangConsole = this.consoleService.getGangConsole();

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
   return this.consoleService.completeLine(_line);
};

LocalConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   process.stdout.write(this.consoleService.executeLine(_line)+"\n");
   this.rl.prompt();
};

module.exports = exports = LocalConsole;
 
