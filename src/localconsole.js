var util = require('util');
var Gang = require('./gang');
var readline = require('readline');

function LocalConsole() {
   this.uName = "console:"+Date.now();

   this.autoCompleteHandler = LocalConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = LocalConsole.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler
   });
}

LocalConsole.prototype.coldStart = function() {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.consoleApiService =  this.casa.findService("consoleapiservice");
   this.consoleApiSession = this.consoleApiService.getSession(this.uName, this);

   this.start("::" + this.casa.uName);
};

LocalConsole.prototype.start = function(_startScope) {
   this.currentScope = _startScope;
   this.setPrompt(this.currentScope);

   this.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
};

LocalConsole.prototype.autoCompleteCb = function(_line, _callback) {
   this.autoComplete(_line.trim(), _callback);
};

LocalConsole.prototype.lineReaderCb = function(_line) {

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

         this.assessScopeAndExecuteCommand(line, (_err, _result) => {
            process.stdout.write(this.processOutput(_err ? _err : _result)+"\n");
            this.prompt();
         });
      }
   }
   else {
      this.prompt();
   }
};

LocalConsole.prototype.assessScopeAndExecuteCommand = function(_line, _callback) {

   this.parseLine(_line, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      if (_result.hasOwnProperty("consoleObjHierarchy")) {
         var cmdObj = null;

         for (var i = 0; i < _result.consoleObjHierarchy.length; ++i) {

            try {
               var ConsoleCmdObj = require("./consolecmds/" + _result.consoleObjHierarchy[i] +  "cmd");
               cmdObj = new ConsoleCmdObj({ uName: _result.consoleObjuName }, this);
               break;
            }
            catch (_err) {
               continue;
            }
         }

         if (cmdObj && _result.method) {

            var cmdMethod = Object.getPrototypeOf(cmdObj)[_result.method];

            if (cmdMethod) {

               try {
                  Object.getPrototypeOf(cmdObj)[_result.method].call(cmdObj, _result.scope, _result.arguments, _callback);
               }
               catch (_err) {
                  _callback(_err);
               }
            }
            else {
               this.executeParsedCommand(_result.scope, _result.method, _result.arguments, _callback);
            }
         }
         else {
            this.executeCommand(_line, (_err, _newResult) => {

               if (_err) {
                  return _callback(_err);
               }

               if (!_result.method) {
                  this.currentScope = _result.newScope;
                  this.setPrompt(_result.newScope);
               }

               _callback(_err, _newResult);
            });
         }
      }
      else {
         _callback("Object not found!");
      }
   });
};

// Override thesee five functions
LocalConsole.prototype.scopeExists = function(_line, _callback) {
   this.consoleApiSession.scopeExists({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.autoComplete = function(_line, _callback) {
   this.consoleApiSession.completeLine({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.parseLine = function(_line, _callback) {
   this.consoleApiSession.parseLine({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.executeCommand = function(_line, _callback) {
   this.consoleApiSession.executeCommand({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
   this.consoleApiSession.executeCommand({ obj: _obj, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.consoleApiSession.executeCommand({ obj: _obj, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.getPromptColour = function(_prompt) {
   return (_prompt.startsWith("::"+this.casa.uName)) ? "\x1b[32m" : "\x1b[31m";
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

LocalConsole.prototype.setPromptMidLine = function(_prompt) {
   this.setPrompt(_prompt);
   this.rl.prompt(true);
};

LocalConsole.prototype.write = function(_line) {
   process.stdout.write(_line + "\n");
};

LocalConsole.prototype.question = function(_question, _callback) {
   this.rl.question(_question, _callback);
};

LocalConsole.prototype.writeOutput = function(_line) {
   process.stdout.write("\n" + this.processOutput(_line) + "\n");
   this.prompt();
};

LocalConsole.prototype.prompt = function() {
   this.rl.prompt();
};

LocalConsole.prototype.setPrompt = function(_prompt) {
   var colour = this.getPromptColour(_prompt);
   this.rl.setPrompt(colour + _prompt + " > \x1b[0m");
};


module.exports = exports = LocalConsole;
 
 
