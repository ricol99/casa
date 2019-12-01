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

   this.setPrompt(this.currentScope + ' > ');

   this.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
}

Console.prototype.autoCompleteCb = function(_line, _callback) {
   var line = _line.trim();

   this.autoComplete({ scope: this.currentScope, line: line }, (_err, _result) => {

      if  (!_err && _result && _result.length > 0) {

         if (line[0] !== ':') {

            for (var i = 0; i < _result[0].length; ++i) {

               if (this.currentScope === "::") {
                  _result[0][i] = _result[0][i].replace("::", "");
               }
               else {
                  _result[0][i] = _result[0][i].replace(this.currentScope+":", "");
                  _result[0][i] = _result[0][i].replace(this.currentScope+".", "");
               }
            }
         }
         else if (line[1] !== ':') {

            for (var i = 0; i < _result[0].length; ++i) {
               _result[0][i] = _result[0][i].replace("::" + this.name, "");
            }
         }
      }
      _callback(_err, _result);
  });
};

Console.prototype.lineReaderCb = function(_line) {

   if (_line === 'exit' || _line ==='quit') {
      process.exit(0);
   }

   var line = _line.trim();

   if (line !== "") {

      if (line.startsWith(":")) {

         if (!line.startsWith("::")) {
            line = "::" + this.name + line;
         }
      }
      else if ((line.indexOf(".") === -1) && (line.indexOf(":") === -1)) {
         line = this.currentScope + "." + line;
      }
      else if (this.currentScope === "::") {
         line = this.currentScope + line;
      }
      else {
         line = this.currentScope + ":" + line;
      }

      if (line[line.length-1] === ':') {
         var newLine = (line === "::") ? line : line.slice(0, line.length-1);

         this.scopeExists(newLine, (_err, _result) => {
        

            if (!_err && _result) {

               if (line.startsWith(this.name)) {
                  this.currentScope = "::" + newLine;
               }
               else {
                  this.currentScope = newLine;
               }
               this.setPrompt(this.currentScope);
            }
            else {
               process.stdout.write("Object not found!\n");
            }
            this.prompt();
         });
         return;
      }

      var command = {};
      var dotSplit = line.split(".");
      command.scope = dotSplit[0];

      if (line.indexOf(".") !== -1) {
         var str = line.split(".").slice(1).join(".");
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
            this.prompt();
            return;
         }
      }

      this.executeCommand(command, (_err, _result) => {
         process.stdout.write(this.processOutput(_err ? _err : _result)+"\n");
         this.prompt();
      });
   }
   else {
      this.prompt();
   }
};

// Override thesee three functions
Console.prototype.autoComplete = function(_line, _callback) {
};

Console.prototype.executeCommand = function(_command, _callback) {
};

Console.prototype.scopeExists = function(_scope, _callback) {
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
 
