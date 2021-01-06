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

   var GangConsoleCmdObj = require("./consolecmds/gangconsolecmd");
   this.gangConsoleCmd = new GangConsoleCmdObj({ name: this.gang.name, sourceCasa: this.casa.name, casaName: this.casa.name }, null, this);

   this.consoleApiService =  this.casa.findService("consoleapiservice");
   this.consoleApiSession = this.consoleApiService.getSession(this.uName, this);
   this.sourceCasa = null;

   this.start("::" + this.casa.name);
};

LocalConsole.prototype.start = function(_startScope) {
   this.currentScope = _startScope;
   this.currentCmdObj = this.gangConsoleCmd;
   this.setPrompt(this.currentScope);

   this.prompt();
   this.rl.on('line', this.lineReaderHandler);

   this.rl.on('close', () => {
     process.exit(0);
   });
};

LocalConsole.prototype.getCasas = function() {
   return [{name: this.casa.name, connected: true}];
};

LocalConsole.prototype.setSourceCasa = function(_casaName, _callback) {
   _callback("Unable to change source casa in local console mode");
};

LocalConsole.prototype.autoCompleteCb = function(_line, _callback) {

   this.extractScope(_line, (_err, _result) => {

      if (_err) {
         return _callback(_err);
      }

      //process.stdout.write("AAAA Result="+util.inspect(_result)+"\n");
      var matches = _result.matchingScopes;

      //var scope = (_result.scope) ? _result.scope : this.currentScope.replace("::", this.gang.name + ":");
      var scope = (this.currentScope === "::") ? ":" : this.currentScope;

      //process.stdout.write("AAAAA LocalConsole.prototype.autoCompleteCb() scope="+scope+"\n");
      //var scope = (_result.scope) ? _result.scope : this.currentScope.replace("::", ":");
      var methodResult = this.extractMethodAndArguments(_line, _result.remainingStr);
      var method = (methodResult.method) ? methodResult.method : "";

      if (_result.hasOwnProperty("consoleObjHierarchy")) {
         methodMatches = this.matchMethods(_line, method, scope, _result.consoleObjHierarchy, _result.consoleObjuName, _result.consoleObjCasaName, _result.sourceCasa);
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
   var line = _line.trim();

   if (line !== "") {

      if (line[line.length-1] === ':') {
         this.extractScope(_line, (_err, _result) => {

            if (!_err && _result.hasOwnProperty("consoleObjHierarchy") && _result.remainingStr === "") {
               //process.stdout.write("AAAA LocalConsole.prototype.lineReaderCb() _result="+util.inspect(_result)+"\n");
               this.currentScope = (_result.consoleObjuName === ":") ? "::" : _result.consoleObjuName;
               this.currentCmdObj = this.getConsoleCmdObj(_result.consoleObjHierarchy, _result.consoleObjuName, _result.consoleObjCasaName, _result.sourceCasa);
               this.setPrompt(this.currentScope);
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

LocalConsole.prototype.createConsoleCmdObj = function(_uName, _owner, _args) {
   //process.stdout.write("AAAAA LocalConsole.prototype.createConsoleCmdObj() _uName="+_uName+", casaName="+_args.consoleObjCasaName+"\n");
   var cmdObj = null;
   var spr = _uName.split(":");
   var name = spr[spr.length-1];

   for (var i = 0; i < _args.consoleObjHierarchy.length; ++i) {

      try {
         var ConsoleCmdObj = require("./consolecmds/" + _args.consoleObjHierarchy[i] +  "cmd");
         cmdObj = new ConsoleCmdObj({ name: name, casaName: _args.consoleObjCasaName, sourceCasa: _args.sourceCasa }, _owner, this);
         break;
      }
      catch (_err) {
         continue;
      }
   }

   if (!cmdObj) {
      var ConsoleCmdObj = require("./consolecmd");
      cmdObj = new ConsoleCmdObj({ name: name, casaName: _args.consoleObjCasaName, sourceCasa: _args.sourceCasa }, _owner, this);
   }

   return cmdObj;
};

LocalConsole.prototype.getConsoleCmdObj = function(_consoleObjHierarchy, _consoleObjuName, _consoleObjCasaName, _sourceCasa) {

   var cmdObj = this.gangConsoleCmd.findOrCreate(_consoleObjuName,
                                                 LocalConsole.prototype.createConsoleCmdObj.bind(this), { consoleObjHierarchy: _consoleObjHierarchy,
                                                                                                          consoleObjCasaName: _consoleObjCasaName,
                                                                                                          sourceCasa: _sourceCasa });
   if (cmdObj && (cmdObj.sourceCasa !== _sourceCasa)) {

      var updateGang =  (cmdObj === this.gangConsoleCmd);

      // CmdObj have been sourced from different casas - replace with new one.
      //process.stdout.write("AAAAAAA LocalConsole.prototype.getConsoleCmdObj() cmdObj.sourceCasa="+cmdObj.sourceCasa+", _sourceCasa="+_sourceCasa+", updateGang="+updateGang+"\n");
      cmdObj = this.gangConsoleCmd.create(_consoleObjuName, true, true,
                                          LocalConsole.prototype.createConsoleCmdObj.bind(this), { consoleObjHierarchy: _consoleObjHierarchy,
                                                                                                   consoleObjCasaName: _consoleObjCasaName,
                                                                                                   sourceCasa: _sourceCasa });

      if (cmdObj && updateGang) {
         //process.stdout.write("AAAAAAA LocalConsole.prototype.getConsoleCmdObj() cmdObj===this.gangConsoleCmd="+util.inspect(cmdObj===this.gangConsoleCmd)+"\n");
         this.gangConsoleCmd = cmdObj
      }
   }

   return cmdObj;
};

LocalConsole.prototype.processMatches = function(_line, _matches) {

   for (var i = 0; i < _matches.length; ++i) {

      if (_line[0] !== ':') {
         var newLine = _matches[i].replace(this.currentScope, "");
         _matches[i] = (newLine[0] === ":") ? newLine.substr(1) : newLine;
      }
   }
};

LocalConsole.prototype.matchMethods = function(_originalLine, _method, _scope, _consoleObjHierarchy, _consoleObjuName, _consoleObjCasaName, _sourceCasa, _perfectMatchRequired) {
   var matches = [];

   if (_consoleObjHierarchy) {
      //process.stdout.write("AAAA matchMethods() console Heirarch = "+util.inspect(_consoleObjHierarchy)+"\n");
      //process.stdout.write("AAAA matchMethods() console obj = "+_consoleObjuName+"\n");

      var cmdObj = this.getConsoleCmdObj(_consoleObjHierarchy, _consoleObjuName, _consoleObjCasaName, _sourceCasa);

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

      //process.stdout.write("AAAA Result="+util.inspect(_result)+"\n");

      if (_err) { 
         return _callback(_err);
      }

      var methodResult = this.extractMethodAndArguments(_line, _result.remainingStr);
      //process.stdout.write("AAAA Method Result="+util.inspect(methodResult)+"\n");

      if (methodResult.method && _result.hasOwnProperty("consoleObjHierarchy")) {
         var cmdObj = this.getConsoleCmdObj(_result.consoleObjHierarchy, _result.consoleObjuName, _result.consoleObjCasaName, _result.sourceCasa);

         if (cmdObj) {
            var methodName = methodResult.method ? methodResult.method : "cat";

            var cmdMethod = Object.getPrototypeOf(cmdObj)[methodName];

            if (cmdMethod) {

               try {
                  Object.getPrototypeOf(cmdObj)[methodName].call(cmdObj, methodResult.arguments, _callback);
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
   //process.stdout.write("AAAAA executeParsedCommand() obj="+util.inspect(_obj)+"\n");
   this.consoleApiSession.executeCommand({ obj: _obj.uName, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.consoleApiSession.executeCommand({ obj: _obj.uName, method: _method, arguments: _arguments }, _callback);
};

LocalConsole.prototype.getPromptColour = function(_prompt) {
   return this.currentCmdObj ? (this.currentCmdObj.casaName === this.currentCmdObj.sourceCasa) ? "\x1b[32m" : "\x1b[31m" : "\x1b[31m";
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
   this.rl.setPrompt(colour + "[" + this.casa.name +"] " + _prompt + " > \x1b[0m");
};

module.exports = exports = LocalConsole;
 
 
