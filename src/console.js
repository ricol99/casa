var crypto = require('crypto');
var readline = require('readline');
var io = require('socket.io-client');
var util = require('./util');
var LocalConsole = require('./localconsole');
var AsyncEmitter = require('./asyncemitter');

function Console(_params) {
   this.secureMode = _params.secureMode;
   this.certPath = _params.certPath;
   this.gangName = _params.gangName;
   this.casaName = _params.casaName;
   this.remoteCasas = {};
   this.offline = true;
   this.connectedCasas = 0;
   this.defaultCasa = null;

   if (this.secureMode) {
      var fs = require('fs');
      this.http = "https";
      this.socketOptions = {
         secure: true,
         rejectUnauthorized: false,
         reconnection: false,
         key: fs.readFileSync(this.certPath+'/client.key'),
         cert: fs.readFileSync(this.certPath+'/client.crt'),
         ca: fs.readFileSync(this.certPath+'/ca.crt'),
         json: true
      };
   }
   else {
      this.http = "http";
      this.socketOptions = { reconnection: false, transports: ['websocket'], json: true };
   }

   LocalConsole.call(this, { gangName: this.gangName });
}

util.inherits(Console, LocalConsole);

Console.prototype.coldStart = function() {
   this.gang = Gang.mainInstance();

   var CasaFinder = require('./casafinder');
   var casaFinder = new CasaFinder({ gang: this.gangName, casa: this.casaName });

   this.casaFoundHandler = Console.prototype.casaFound.bind(this);
   casaFinder.on("casa-found", this.casaFoundHandler);

   casaFinder.coldStart();
   casaFinder.startSearching();

   this.offlineCasa = new OfflineCasa({ name: "casa:offlinecase" }, this);

   this.start("::");
};

Console.prototype.casaFound = function(_params) {

   if (!this.remoteCasas.hasOwnProperty(_params.name)) {
      var remoteCasa = new RemoteCasa(_params, this);
      this.remoteCasas[_params.name] = remoteCasa;

      remoteCasa.on("connected", (_data) => {
         this.connectedCasas = this.connectedCasas + 1;

         this.gang.getDb(_data.name, _data, (_err, _result, _data) => {

            if (_err) {
               this.writeOutput("Casa "+_data.name+" has joined and console does not have a local db for it!");
            }
            else {
               this.remoteCasas[_data.name].setDb(_result);
            }

            if (this.offline) {
               this.defaultCasa = this.remoteCasas[_data.name];
               this.offline = false;
               this.updatePromptMidLine();
            }
            else {
               this.updatePromptMidLine();
            }
         });
      });

      remoteCasa.on("connect_error", (_data) => {
      });

      remoteCasa.on("disconnected", (_data) => {
         this.connectedCasas = this.connectedCasas - 1;

         if (this.connectedCasas === 0) {
            this.offline = true;
            this.currentScope = "::";
         }

         this.updatePrompt();
         this.writeOutput("Casa "+_data.name+" disconnected");

         if ((this.connectedCasas >  0) && (this.defaultCasa && this.defaultCasa === this.remoteCasas[_data.name])) {
            this.defaultCasa = null;

            for (var casa in this.remoteCasas) {

               if (this.remoteCasas.hasOwnProperty(casa) && this.remoteCasas[casa].connected) {
                  this.defaultCasa = this.remoteCasas[casa];
                  break;
               }
            }
         }
      });

      remoteCasa.on("output", (_data) => {
         this.writeOutput(this.processOutput(_data.result));
      });

      remoteCasa.start();
   }
   else {
      this.remoteCasas[_params.name].reconnect(_params);
   }
};

Console.prototype.getPromptColour = function(_prompt) {

   if (_prompt.startsWith(":: ")) {
      return "\x1b[32m";
   }
   else {
      var currentCasa = _prompt.substr(2).replace(" ", ":").split(":")[0] +":" + _prompt.substr(2).replace(" ", ":").split(":")[1];
      return (this.remoteCasas.hasOwnProperty(currentCasa) && this.remoteCasas[currentCasa].connected) ? "\x1b[32m" : "\x1b[31m";
   }
};

Console.prototype.getCasaName = function(_line) {
   var casaName = null;

   if ((_line.length === 1) && (_line === ":")) {
      casaName = (this.currentScope === "::") ? "" : this.currentScope.replace("::", "").split(":")[0] + ":" + this.currentScope.replace("::", "").split(":")[1];
   }
   else if ((_line.length >= 1) && (_line[0] === ':')) {
      var splitStrs = (_line[1] ===':') ? _line.substr(2).replace(".", ":").split(":") : _line.substr(1).replace(".", ":").split(":");
      casaName = (splitStrs.length >= 2) ? splitStrs[0] + ":" + splitStrs[1] : "";
   }
   else if (this.currentScope === "::") {
      var splitStrs = _line.replace(".", ":").split(":");
      casaName = (splitStrs.length >= 2) ? splitStrs[0] + ":" + splitStrs[1] : "";
   }
   else {
      var splitStrs = this.currentScope.substr(2).split(":");
      casaName = (splitStrs.length >= 2) ? splitStrs[0] + ":" + splitStrs[1] : "";
   }

   return casaName;
};

Console.prototype.identifyCasaAndSendCommand = function(_line, _func, _callback) {

   if (this.offline) {
      return this.sendCommandToCasa(this.offlineCasa, _line, _func, _callback);
   }

   var casaName = this.getCasaName(_line);

   if (this.remoteCasas.hasOwnProperty(casaName)) {

      if (!this.sendCommandToCasa(this.remoteCasas[casaName], _line, _func, _callback)) {

         if (!(this.defaultCasa && this.sendCommandToCasa(this.defaultCasa, _line, _func, _callback))) {
            _callback("Object not found!");
         }
      }
   }
   else if (!(this.defaultCasa && this.sendCommandToCasa(this.defaultCasa, _line, _func, _callback))) {
      _callback("Object not found!");
   }
};

Console.prototype.sendCommandToCasa = function(_casa, _line, _func, _callback) {
   return Object.getPrototypeOf(_casa)[_func].call(_casa, _line, _callback);
};

Console.prototype.sendCommandToAllCasas = function(_line, _func, _callback) {

   if (this.offline) {
      return this.sendCommandToCasa(this.offlineCasa, _linw, _func, _callback);
   }

   if (this.allCasaCommandOngoing)  {
      return false;
   }

   this.allCasaCommandOngoing = true;
   this.allCasaCommandError = null;
   this.allCasaCommandResult = null;
   this.allCasaCommandCallback  = _callback;
   this.allCasaCommandRequiredResponses = 0;
   this.allCasaCommandHandler = Console.prototype.allCommandCb.bind(this);

   for (var remoteCasa in this.remoteCasas) {

      if (this.remoteCasas.hasOwnProperty(remoteCasa)) {

         if (this.sendCommandToCasa(this.remoteCasas[remoteCasa], _line, _func, this.allCasaCommandHandler)) {
            this.allCasaCommandRequiredResponses = this.allCasaCommandRequiredResponses + 1;
         }
      }
   }

   if (this.allCasaCommandRequiredResponses === 0) {
      this.allCasaCommandOngoing = false;
      return false;
   }

   return true;
};

Console.prototype.allCommandCb = function(_err, _result) {

   if (_err) {
      this.allCommandError = _err;
   }
   else {
      this.allCommandResult = _result;
   }

   this.allCasaCommandRequiredResponses = this.allCasaCommandRequiredResponses - 1;

   if (this.allCasaCommandRequiredResponses === 0) {
      this.allCasaCommandOngoing = false;
      this.allCasaCommandCallback(this.allCommandError, this.allCommandResult);
   }
};

Console.prototype.scopeExists = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "scopeExists", _callback);
};

Console.prototype.parseLine = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "parseLine", _callback);
};

Console.prototype.autoComplete = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "autoComplete", _callback);
};

Console.prototype.executeCommand = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "executeCommand", _callback);
};

Console.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
   this.identifyCasaAndSendCommand([_obj, _method, _arguments], "executeParsedCommand", _callback);
};

Console.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.sendCommandToAllCasas([_obj, _method, _arguments], "executeParsedCommand", _callback);
};

Console.prototype.getConnectedCasas = function() {
   var connectedCasas = [];

   for (var casa in this.remoteCasas) {

     if (this.remoteCasas.hasOwnProperty(casa) && this.remoteCasas[casa].connected) {
        connectedCasas.push(casa);
     }
   }

   return connectedCasas;
};

Console.prototype.setPrompt = function(_prompt) {
   LocalConsole.prototype.setPrompt.call(this, _prompt + " [" + this.connectedCasas + "]");
};

Console.prototype.updatePrompt = function() {
   LocalConsole.prototype.setPrompt.call(this, this.currentScope + " [" + this.connectedCasas + "]");
};

Console.prototype.updatePromptMidLine = function() {
   LocalConsole.prototype.setPromptMidLine.call(this, this.currentScope);
};

function RemoteCasa(_config, _owner) {
   AsyncEmitter.call(this);
   this.owner = _owner;
   this.name = _config.name;
   this.host = _config.host;
   this.port = _config.port;
   this.db = null;
   this.connected = false;
}

util.inherits(RemoteCasa, AsyncEmitter);

RemoteCasa.prototype.start = function()  {
   this.socket = io(this.owner.http + '://' + this.host + ':' + this.port + '/consoleapi/io', this.owner.socketOptions);

   this.socket.on('connect', (_data) => {
      this.connected = true;
      this.emit('connected', { name: this.name });
   });

   this.socket.on('connect_error', (_data) => {
      _data.name = this.name;
      this.emit('connect_error', _data);
   });

   this.socket.on('output', (_data) => {
      _data.name = this.name;
      this.emit('output', _data);
   });

   this.socket.on('scope-exists-output', (_data) => {

      if (this.scopeExistsCallback) {
         this.scopeExistsCallback(null, _data);
      }
   });

   this.socket.on('parse-output', (_data) => {

      if (this.parseCallback) {
         this.parseCallback(null, _data.result);
      }
   });

   this.socket.on('complete-output', (_data) => {

      if (this.completeCallback) {
         this.completeCallback(null, _data.result);
      }
   });

   this.socket.on('execute-output', (_data) => {
      if (this.executeCallback) {
         this.executeCallback(null, _data.result);
      }
   });

   this.socket.on('disconnect', (_data) => {

      if (this.connected) {
         _data.name = this.name;
         this.connected = false;
         this.emit('disconnected', { name: this.name });
      }
   });

   this.socket.on('error', (_data) => {

      if (this.connected) {
         _data.name = this.name;
         this.connected = false;
         this.emit('disconnected', _data);
      }
   });
};

RemoteCasa.prototype.setDb = function(_db) {
   this.db = _db;
};

RemoteCasa.prototype.reconnect = function(_params) {

   if (!this.connected) {
      this.host = _params.host;
      this.port = _params.port;
      this.start();
   }
};

RemoteCasa.prototype.scopeExists = function(_line, _callback) {

   if (this.connected) {
      this.scopeExistsCallback = _callback;
      this.socket.emit('scopeExists', { scope: this.owner.currentScope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.parseLine = function(_line, _callback) {

   if (this.connected) {
      this.parseCallback = _callback;
      this.socket.emit('parseLine', { scope: this.owner.currentScope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.autoComplete = function(_line, _callback) {

   if (this.connected) {
      this.completeCallback = _callback;
      this.socket.emit('completeLine', { scope: this.owner.currentScope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.executeCommand = function(_line, _callback) {

   if (this.connected) {
      this.executeCallback = _callback;
      this.socket.emit('executeCommand', { scope: this.owner.currentScope, line: _line });
      return true;
   }
   else {
      return false;
   }
};

RemoteCasa.prototype.executeParsedCommand = function(_command, _callback) {

   if (this.connected) {
      this.executeCallback = _callback;
      this.socket.emit('executeCommand', { obj: _command[0], method: _command[1], arguments: _command[2] });
      return true;
   }
   else {
      return false;
   }
};

function OfflineCasa(_config, _owner) {
   this.owner = _owner;
   this.name = _config.name;
   this.db = this.owner.gang.getDb();

   var ConsoleCmdObj = require("./consolecmds/offlinecasaconsolecmd");
   this.cmdObj = new ConsoleCmdObj({ uName: "casa:offlinecasa" }, this);
   this.methods = Object.getPrototypeOf(this.cmdObj);
}

OfflineCasa.prototype.scopeExists = function(_line, _callback) {
   var gScope = _line.startsWith("::");

   if (_callback) {
      _callback(null, gScope ? (_line.replace("::", "").split("(")[0].indexOf(':') === -1) : (_line.split("(")[0].indexOf(':') === -1));
   }
   else {
      return gScope ? (_line.replace("::", "").split("(")[0].indexOf(':') === -1) : (_line.split("(")[0].indexOf(':') === -1);
   }
};

OfflineCasa.prototype.parseLine = function(_line, _callback) {

   if (!this.scopeExists(_line)) {

      if (_callback) {
         return _callback("Object does not exist!");
      }
      else {
         return null;
      }
   }

   var line = _line.replace("::", "");
   var method = _line.split("(")[0];
   var consoleObjHierarchy = [ "offlinecasaconsole" ];
   var scope = "::";
   var arguments = [];
   var consoleObjuName = "offlinecasaconsolecmd:offline";

   if (line.split("(").length > 1) {
      var methodArguments = line.split("(").slice(1).join("(").trim();
      var i;

      for (i = methodArguments.length-1; i >= 0; --i) {

         if (methodArguments.charAt(i) == ')') {
            break;
         }
      }

      if (i !== 0) {
         methodArguments = methodArguments.substring(0, i);
         arguments = JSON.parse("["+methodArguments+"]");
      }
   }

   if (_callback) {
      _callback(null, { line: _line, method: method, consoleObjHierarchy: consoleObjHierarchy, scope: scope, arguments: arguments, consoleObjuName: consoleObjuName });
   }
   else {
      return { line: _line, method: method, consoleObjHierarchy: consoleObjHierarchy, scope: scope, arguments: arguments, consoleObjuName: consoleObjuName };
   }
};

OfflineCasa.prototype.autoComplete = function(_line, _callback) {
   return _callback(null, [ this.findMatchingMethod(_line.replace("::", "")), _line ]);
};

OfflineCasa.prototype.executeCommand = function(_line, _callback) {
   _callback("Casa is offline!");
};

OfflineCasa.prototype.executeParsedCommand = function(_command, _callback) {
   _callback("Casa is offline!");
};

OfflineCasa.prototype.findMatchingMethod = function(_matchString) {
   var matchingMethods = [];

   for (var method in this.methods) {

      if (this.methods.hasOwnProperty(method) && method.startsWith(_matchString)) {
         matchingMethods.push(method);
      }
   }

   return matchingMethods;
};

module.exports = exports = Console;

