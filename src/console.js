var readline = require('readline');
var util = require('util');
var Gang = require('./gang');

function Console(_config) {
   this.uName = "console:"+Date.now();
   this.name = _config.name;
   this.gangName = _config.gangName;
   this.currentScope = "::" + this.name;

   this.autoCompleteHandler = Console.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = Console.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler
   });

   this.setPrompt(this.currentScope);

   this.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
}

Console.prototype.autoCompleteCb = function(_line, _callback) {
   this.autoComplete(_line.trim(), _callback);
};

Console.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   var line = _line.trim();

   if (line !== "") {

      if (line[line.length-1] === ':') {
         this.scopeExists(line, (_err, _result) => {

            if (!_err && _result.exists) {
               this.currentScope = _result.newScope;
               this.setPrompt(_result.newScope);
            }
            this.prompt();
         });
      }
      else {

         this.executeCommand(line, (_err, _result) => {
            process.stdout.write(this.processOutput(_err ? _err : _result)+"\n");
            this.prompt();
         });
      }
   }
   else {
      this.prompt();
   }
};

// Override thesee three functions
Console.prototype.autoComplete = function(_line, _callback) {
};

Console.prototype.executeCommand = function(_line, _callback) {
};

Console.prototype.scopeExists = function(_line, _callback) {
   _callback(null, true);
};

Console.prototype.processOutput = function(_outputOfEvaluation) {

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

Console.prototype.writeOutput = function(_line) {
   process.stdout.write("\n" + this.processOutput(_line) + "\ncasa > ");
};

Console.prototype.prompt = function() {
   this.rl.prompt();
};

Console.prototype.setPrompt = function(_prompt) {
   var colour = _prompt.startsWith("::"+this.name) ? "\x1b[32m" : "\x1b[31m";
   this.rl.setPrompt(colour + _prompt + " > \x1b[0m");
};

module.exports = exports = Console;
 
