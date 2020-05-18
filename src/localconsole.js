var util = require('util');
var Gang = require('./gang');
var readline = require('readline');
var NamedObject = require('./namedobject');

function LocalConsole(_owner) {
   NamedObject.call(this, { name: "console-"+Date.now(), type: "localconsole" }, _owner);

   this.autoCompleteHandler = LocalConsole.prototype.autoCompleteCb.bind(this);
   this.lineReaderHandler = LocalConsole.prototype.lineReaderCb.bind(this);

   this.rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     completer: this.autoCompleteHandler
   });
}

util.inherits(LocalConsole, NamedObject);

LocalConsole.prototype.coldStart = function() {
   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
   this.consoleApiService =  this.casa.findService("consoleapiservice");
   this.consoleApiSession = this.consoleApiService.getSession(this.uName, this);

   this.start("::" + this.casa.name);
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

   this.extractScope(_line, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      process.stdout.write("AAAA Result="+util.inspect(_result)+"\n");
      var matches = _result.matchingScopes;

      var scope = (_result.scope) ? _result.scope : this.currentScope.replace("::", this.gang.name + ":");
      var methodResult = this.extractMethodAndArguments(_line, _result.remainingStr);
      var method = (methodResult.method) ? methodResult.method : "";

      if (_result.hasOwnProperty("consoleObjHierarchy")) {
         methodMatches = this.matchMethods(_line, method, scope, _result.consoleObjHierarchy, _result.consoleObjName);
         matches = methodMatches.concat(_result.matchingScopes);
      }

      if (_callback) {
         _callback(null, [ matches, _line]);
      }
      else {
         return [ matches, _line ];
      }
   });
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

LocalConsole.prototype.getConsoleCmdObj = function(_consoleObjHierarchy, _consoleObjName) {
   var cmdObj = null;

   for (var i = 0; i < _consoleObjHierarchy.length; ++i) {

      try {
         var ConsoleCmdObj = require("./consolecmds/" + _consoleObjHierarchy[i] +  "cmd");
         cmdObj = new ConsoleCmdObj({ name: _consoleObjName }, this);
         break;
      }
      catch (_err) {
         continue;
      }
   }

   return cmdObj;
};

LocalConsole.prototype.processMatches = function(_line, _matches) {
   var scope = (this.currentScope === "::") ? this.gang.name : this.gang.name + this.currentScope.substr(1);

   for (var i = 0; i < _matches.length; ++i) {

      if (_line[0] === ':') {
         _matches[i] = (_line[1] === ':') ? "::"+_matches[i].substr(this.gang.name.length+1) : ":"+_matches[i].replace(this.gang.name+":"+this.getCasaName(), "").substr(1);
      }
      else  {
         _matches[i] = _matches[i].replace(scope, "").substr(1);
      }
   }
};

LocalConsole.prototype.matchMethods = function(_originalLine, _method, _scope, _consoleObjHierarchy, _consoleObjName, _perfectMatchRequired) {
   var matches = [];

   if (_consoleObjHierarchy) {
      var cmdObj = this.getConsoleCmdObj(_consoleObjHierarchy, _consoleObjName);

      if (cmdObj) {
         matches = cmdObj.filterMembers(_method, undefined, _scope);
         this.processMatches(_originalLine, matches);
      }
   }

   return matches;
};

LocalConsole.prototype.extractMethodAndArguments = function(_originalLine, _line) {
   var line = (_line.length > 0) ? ((_line[0] === ".") ? _line.substr(1) : _line) : _line;
   var spacePos = (line.indexOf(' ') === -1) ? 10000 : line.indexOf(' ');
   var bracketPos = (line.indexOf('(') === -1) ? 10000 : line.indexOf('(');
   var separator = '(';
   var methodArguments;
   var methodSeparator = (spacePos < bracketPos) ? ' ' : '(';
   var splitLine = line.split(methodSeparator);
   var method = (splitLine[0].length > 0) ? splitLine[0] : null;

   if (splitLine.length > 1) {
      var argFormat = (methodSeparator === '(') ? 'js' : (splitLine[1].trim()[0] === '(') ? 'js' : 'space';
      var arguments;

      if (argFormat === 'space') {
         arguments = "\"" + splitLine.slice(1).join(" ").match(/[\w-]+|"(?:\\"|[^"])+"/g).join("\",\"") + "\")";
         arguments = arguments.replace(/""/g,"\"");
      }
      else {
         arguments = line.split("(").slice(1).join("(").trim();
      }

      var lastIndex = arguments.lastIndexOf(")");

      if (lastIndex !== -1) {
         arguments = arguments.substring(0, lastIndex);

         try {
            methodArguments = JSON.parse("["+arguments+"]");
         }
         catch (_err) {
            return { error: "Unable to parse arguments: " + _err };
         }
      }
      else {
         return { error: "Unable to parse arguments: No closing parenthesis" };
      }
   }

   return { method: method, arguments: methodArguments };
};

LocalConsole.prototype.assessScopeAndExecuteCommand = function(_line, _callback) {

   this.extractScope(_line, (_err, _result) => {
      var err = _err ? _err : "Object not found";

      if (_err || !_result.scope) {
         return _callback(_err);
      }

      var methodResult = this.extractMethodAndArguments(_line, _result.remainingStr);

      if (methodResult.method && _result.hasOwnProperty("consoleObjHierarchy")) {
         var cmdObj = this.getConsoleCmdObj(_result.consoleObjHierarchy, _result.consoleObjName);

         if (cmdObj) {
            var methodName = methodResult.method ? methodResult.method : "cat";

            var cmdMethod = Object.getPrototypeOf(cmdObj)[methodName];

            if (cmdMethod) {

               try {
                  Object.getPrototypeOf(cmdObj)[methodName].call(cmdObj, _result.scope, methodResult.arguments, _callback);
               }
               catch (_err) {
                  _callback(_err);
               }
            }
            else {
               _callback("Command not found!");
            }
         }
         else {
            _callback("Object not found!");
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

LocalConsole.prototype.extractScope = function(_line, _callback) {
   this.consoleApiSession.extractScope({ scope: this.currentScope, line: _line }, _callback);
};

LocalConsole.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
   this.consoleApiSession.executeCommand({ obj: _obj, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.consoleApiSession.executeCommand({ obj: _obj, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.getPromptColour = function(_prompt) {
   return (_prompt.startsWith("::"+this.casa.name)) ? "\x1b[32m" : "\x1b[31m";
};

LocalConsole.prototype.getCasaName = function(_line) {
   this.gang.casa.name;
};


LocalConsole.prototype.getCasa = function(_name) {
   return this.gang.casa;
};

//
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
 
 
