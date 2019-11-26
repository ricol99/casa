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

      var result = this.consoleSession.executeCommand(command);
      process.stdout.write(this.processOutput(result)+"\n");
   }

   this.rl.prompt();
};

LocalConsole.prototype.processOutput = function(_outputOfEvaluation) {

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

LocalConsole.prototype.writeOutput = function(_line) {
   process.stdout.write("\n" + this.processOutput(_line) + "\ncasa > ");
};

module.exports = exports = LocalConsole;
 
