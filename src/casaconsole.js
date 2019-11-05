var util = require('./util');
var Gang = require('./gang');
var readline = require('readline');

function CasaConsole() {
   this.gang = Gang.mainInstance();

   this.autoCompleteHandler = CasaConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = CasaConsole.prototype.lineReaderCb.bind(this);

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

CasaConsole.prototype.autoCompleteCb = function(_line) {
   var hits = this.gang.filterGlobalObjects(_line);
   return [ hits, _line];
};

CasaConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   process.stdout.write(util.inspect(this.gang.findObject(_line)) + ' ');
   this.rl.prompt();
};

module.exports = exports = CasaConsole;
