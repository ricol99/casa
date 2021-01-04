var crypto = require('crypto');
var readline = require('readline');
var io = require('socket.io-client');
var util = require('./util');
var LocalConsole = require('./localconsole');
var AsyncEmitter = require('./asyncemitter');

function Console(_params, _owner) {
   this.secureMode = _params.secureMode;
   this.certPath = _params.certPath;
   this.gangName = _params.gangName;
   this.casaName = _params.casaName;
   this.remoteCasas = {};
   this.offline = true;
   this.connectedCasas = 0;
   this.defaultCasa = null;
   this.sourceCasa =  null;

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

   LocalConsole.call(this, _owner);
}

util.inherits(Console, LocalConsole);

Console.prototype.coldStart = function() {
   this.gang = Gang.mainInstance();

   var GangConsoleCmdObj = require("./consolecmds/gangconsolecmd");
   this.gangConsoleCmd = new GangConsoleCmdObj({ name: this.gang.name }, null, this);

   var CasaFinder = require('./casafinder');
   var casaFinder = new CasaFinder({ gang: this.gangName, casa: this.casaName });

   this.casaFoundHandler = Console.prototype.casaFound.bind(this);
   casaFinder.on("casa-found", this.casaFoundHandler);

   casaFinder.coldStart();
   casaFinder.startSearching();

   this.offlineCasa = new OfflineCasa({ name: "offlinecasa" }, this);

   this.start("::");
};

Console.prototype.setSourceCasa = function(_casaName) {

   if (_casaName) {
      this.sourceCasa = this.remoteCasas[_casaName] ? this.remoteCasas[_casaName] : null;
      this.updatePrompt();
   }
   else {
      this.sourceCasa = null;
   }
};

Console.prototype.casaFound = function(_params) {

   if (!this.remoteCasas.hasOwnProperty(_params.name)) {
      var remoteCasa = new RemoteCasa(_params, this);
      this.remoteCasas[_params.name] = remoteCasa;

      remoteCasa.on("connected", (_data) => {
         this.connectedCasas = this.connectedCasas + 1;

         if (this.offline) {
            this.defaultCasa = this.remoteCasas[_data.name];
            this.offline = false;
         }

         this.updatePromptMidLine();
      });

      remoteCasa.on("connect_error", (_data) => {
      });

      remoteCasa.on("disconnected", (_data) => {
         this.connectedCasas = this.connectedCasas - 1;

         if (this.connectedCasas === 0) {
            this.offline = true;
            this.currentScope = "::";
            this.sourceCasa = null;
         }

         this.updatePrompt();
         this.writeOutput("Casa "+_data.name+" disconnected");

         if (this.connectedCasas >  0)  {

            if ((this.defaultCasa && this.defaultCasa === this.remoteCasas[_data.name])) {
               this.defaultCasa = null;

               for (var casa in this.remoteCasas) {

                  if (this.remoteCasas.hasOwnProperty(casa) && this.remoteCasas[casa].connected) {
                     this.defaultCasa = this.remoteCasas[casa];
                     break;
                  }
               }
            }

            if (this.sourceCasa && this.sourceCasa === this.remoteCasas[_data.name]) {
               this.sourceCasa = null;
               this.updatePrompt();
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

Console.prototype.cmdObjectSourcedFromOwner = function(_objectName) {
   var cmdObj = this.gangConsoleCmd.findNamedObject(_objectName);
   return (cmdObj && cmdObj.casaName) ? (cmdObj.casaName === cmdObj.sourceCasa) : true;
};

Console.prototype.getPromptColour = function(_prompt) {
   return this.cmdObjectSourcedFromOwner(_prompt.split(" :")[0])  ? "\x1b[32m" : "\x1b[31m";
};

Console.prototype.identifyCasa = function(_line) {
   return this.offline ? this.offlineCasa : this.sourceCasa ? this.sourceCasa : (this.remoteCasas.hasOwnProperty(this.currentCmdObj.casaName) && this.remoteCasas[this.currentCmdObj.casaName].connected) ? this.remoteCasas[this.currentCmdObj.casaName] : this.defaultCasa;
};

Console.prototype.identifyCasaAndSendCommand = function(_line, _func, _callback) {
   var casa = this.identifyCasa(_line);

   if (casa) {
      this.sendCommandToCasa(casa, _line, _func, _callback);
   }
   else {
      return _callback("No Casa connected!");
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

Console.prototype.extractScope = function(_line, _callback) {
   var casa = this.identifyCasa(_line);

   if (casa) {
      this.sendCommandToCasa(casa, _line, "extractScope", (_err, _result) => {

         if (_err) {
            return _callback(_err);
         }

         if (!this.sourceCasa && _result.hasOwnProperty("consoleObjCasaName") && _result.consoleObjCasaName && (_result.consoleObjCasaName !== casa.name)) {
            // Object resides in a different casa - need to send request to owning casa

            if (!this.remoteCasas.hasOwnProperty(_result.consoleObjCasaName)) {
               return _callback("Object not available as not connected to owning casa!");
            }

            var newCasaName = this.remoteCasas[_result.consoleObjCasaName].name;

            this.sendCommandToCasa(this.remoteCasas[_result.consoleObjCasaName], _line, "extractScope", (_err,_result) =>  {
               if (!_err) _result.sourceCasa = newCasaName;
               return _callback(_err, _result);
            });
         }
         else {
            //_result.sourceCasa = casa.name;
            return _callback(_err, _result);
         }
      });
   }
   else {
      return _callback("No Casa connected!");
   }
};

Console.prototype.autoComplete = function(_line, _callback) {
   this.identifyCasaAndSendCommand(_line, "autoComplete", _callback);
};

Console.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
   process.stdout.write("AAAA Console.prototype.executeParsedCommand() _obj.casaName="+_obj.casaName+", _obj.uName="+_obj.uName+"\n");

   if (_obj.casaName) {

      if (this.remoteCasas.hasOwnProperty(_obj.casaName)) {
         this.sendCommandToCasa(this.remoteCasas[_obj.casaName], [_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
      }
      else {
         return _callback("Owning Casa not connected");
      }
   }
   else {
      var casa = this.identifyCasa(_obj.uName);

      if (casa) {
         this.sendCommandToCasa(casa, [_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
      }
      else {
         return _callback("No Casa connected");
      }
   }
};

Console.prototype.executeParsedCommandOnAllCasas = function(_obj, _method, _arguments, _callback) {
   this.sendCommandToAllCasas([_obj.uName, _method, _arguments], "executeParsedCommand", _callback);
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
   var colour = this.getPromptColour(_prompt);

   if (this.sourceCasa) {
      this.rl.setPrompt(colour + "[" + this.sourceCasa.name +"] " + _prompt + " [" + this.connectedCasas + "]" + " > \x1b[0m");
   }
   else {
      var cmdObj = this.gangConsoleCmd.findNamedObject(_prompt.split(" :")[0]);
      var casaName = (cmdObj && cmdObj.sourceCasa)  ?  cmdObj.sourceCasa : this.defaultCasa ? this.defaultCasa.name : "null";
      this.rl.setPrompt(colour + "[" + casaName +"*] " + _prompt + " [" + this.connectedCasas + "]" + " > \x1b[0m");
  }
};

Console.prototype.updatePrompt = function() {
   LocalConsole.prototype.setPrompt.call(this, this.currentScope + " [" + this.connectedCasas + "]");
};

Console.prototype.updatePromptMidLine = function() {
   LocalConsole.prototype.setPromptMidLine.call(this, this.currentScope);
};

Console.prototype.getCasa = function(_name) {
   return this.remoteCasas[_name];
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

      this.owner.gang.getDb(this.name, undefined, (_err, _db, _data) => {

         if (_err) {
            this.owner.writeOutput("Casa "+this.name+" has joined and console does not have a local db for it!");
         }
         else {
            this.db = _db;
            this.db.lastModified((_err, _result) => {

               if (!_err) {
                  this.dbLastModified = _result;
                  this.socket.emit('get-casa-info');
               }
            });
         }
      });
   });

   this.socket.on('casa-info', (_data) => {

      if (_data.hasOwnProperty("dbInfo")) {

         if (_data.dbInfo.hash !== this.db.getHash()) {

            if (_data.dbInfo.lastModified > this.dbLastModified) {
            }
            else {
            }
         }
      }
      else {
      }
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

   this.socket.on('extract-scope-output', (_data) => {

      if (this.extractScopeCallback) {
         this.extractScopeCallback(null, _data.result);
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

RemoteCasa.prototype.reconnect = function(_params) {

   if (!this.connected) {
      this.host = _params.host;
      this.port = _params.port;
      this.start();
   }
};

RemoteCasa.prototype.getListeningPort = function() {
   return this.port;
};

RemoteCasa.prototype.getHost = function() {
   return this.host;
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

RemoteCasa.prototype.extractScope = function(_line, _callback) {

   if (this.connected) {
      this.extractScopeCallback = _callback;
      this.socket.emit('extractScope', { scope: this.owner.currentScope, line: _line });
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
   this.cmdObj = new ConsoleCmdObj({ name: "offlinecasa", casaName: "offlinecasa", sourceCasa: "offlinecasa" }, this.owner.gangConsoleCmd, this.owner);
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

OfflineCasa.prototype.extractScope = function(_line, _callback) {

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
   var consoleObjuName = "offline";

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

OfflineCasa.prototype.executeParsedCommand = function(_obj, _method, _arguments, _callback) {
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

OfflineCasa.prototype.getCasa = function(_name) {
   return this;
};

module.exports = exports = Console;

