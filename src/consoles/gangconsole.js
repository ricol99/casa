var Console = require('../console');
var readline = require('readline');
var util = require('util');

function GangConsole(_config, _owner) {
   Console.call(this, _config, _owner);
   this.fullScopeName = "";
   this.consoleObjects[this.uName] = this;

   this.autoCompleteHandler = GangConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = GangConsole.prototype.lineReaderCb.bind(this);

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

util.inherits(GangConsole, Console);

GangConsole.prototype.autoCompleteCb = function(_line) {
   var dotSplit = _line.split(".");

   var result = this.filterScope(dotSplit[0].split(":"), 0);

   if (_line.indexOf(".") !== -1  && result.consoleObj) {
       dotSplit.splice(0, 1);
       result.hits = result.consoleObj.filterMembers(dotSplit);
   }

   return [ result.hits, _line];
};

GangConsole.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   var dotSplit = _line.split(".");
   var result = this.filterScope(dotSplit[0].split(":"), 0);

   if (_line.indexOf(".") !== -1 && result.consoleObj) {
       var i = 0;
       dotSplit.splice(0, 1);
       var outputOfEvaluation = result.consoleObj;
       outputOfEvaluation = eval("outputOfEvaluation."+dotSplit[0]);

       while (typeof outputOfEvaluation === 'object' && dotSplit.length > 1) {
          dotSplit.splice(0, 1);
          outputOfEvaluation = eval("outputOfEvaluation."+dotSplit[0]);
       }

       if (outputOfEvaluation) {
          if (typeof outputOfEvaluation === 'object') {
             process.stdout.write("("+util.inspect(outputOfEvaluation)+")\n");
          }
          else {
             process.stdout.write("("+outputOfEvaluation.toString()+")\n");
          }
       }
       else {
          process.stdout.write("("+outputOfEvaluation+")\n");
       }
   }
   else if (result.consoleObj) {
      result.consoleObj.cat();
   }
   else {
      process.stdout.write("-> Object not found!\n");
   }

   this.rl.prompt();
};

GangConsole.prototype.cat = function() {
};

module.exports = exports = GangConsole;
 
