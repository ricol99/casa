var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function ConsoleApiService(_config) {
   _config.socketIoSupported = true;
   WebService.call(this, _config);
   this.sessions = {};
}

util.inherits(ConsoleApiService, WebService);

ConsoleApiService.prototype.coldStart = function() {
   var GlobalConsoleApiObj = require("../consoleapis/globalconsoleapi");
   this.globalConsoleApi = new GlobalConsoleApiObj({ uName: "global:global" });

   this.addRoute('/consoleapi/scopeExists/:scope/:line', ConsoleApiService.prototype.scopeExistsRequest.bind(this));
   this.addRoute('/consoleapi/parseLine/:scope/:line', ConsoleApiService.prototype.parseLineRequest.bind(this));
   this.addRoute('/consoleapi/completeLine/:scope/:line', ConsoleApiService.prototype.completeLineRequest.bind(this));
   this.addRoute('/consoleapi/executeCommand/:scope/:method/:arguments', ConsoleApiService.prototype.executeCommandRequest.bind(this));
   this.addIoRoute('/consoleapi/io', ConsoleApiService.prototype.socketIoConnection.bind(this));

   WebService.prototype.coldStart.call(this);
};

ConsoleApiService.prototype.getGlobalConsoleApi = function() {
   return this.globalConsoleApi;
};

ConsoleApiService.prototype.scopeExistsRequest = function(_request, _response) {
   console.log(this.uName+": scopeExistsRequest() request=", _request.params);
   
   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else { 
      var id = "oneshotconsoleapiesession:"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('scopeExists', _request, _response);
   }
};

ConsoleApiService.prototype.parseLineRequest = function(_request, _response) {
   console.log(this.uName+": parseLineRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsoleapiesession:"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('parseLine', _request, _response);
   }
};

ConsoleApiService.prototype.completeLineRequest = function(_request, _response) {
   console.log(this.uName+": completeLineRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsoleapiesession:"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('completeLine', _request, _response);
   }
};

ConsoleApiService.prototype.executeCommandRequest = function(_request, _response) {
   console.log(this.uName+": executeCommandRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsoleapisession:"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[i].performOneShotHttpRequest('executeCommand', _request, _response);
   }
};

ConsoleApiService.prototype.sendFail = function(_request, _response) {
   _response.status(404);

   if (_request.accepts('json')) {
     _response.send({ error: 'Not found' });
   }
   else {
      _response.type('txt').send('Not found');
   }
};

ConsoleApiService.prototype.setCurrentSession = function(_session) {

   if (_session) {
      this.currentSessionId = _session.uName;
   }
   else {
      this.currentSessionId = null;
   }
};

ConsoleApiService.prototype.getCurrentSession = function() {
   return this.sessions[this.currentSessionId];
};

ConsoleApiService.prototype.getSessionVars = function(_consoleApiObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].consoleApiObjVars[_consoleApiObj.uName];
   }
   else {
      return null;
   }
};

ConsoleApiService.prototype.getSessionVar = function(_name, _consoleApiObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].getSessionVar(_name, _consoleApiObj.uName);
   }
   else {
      return null;
   }
};

ConsoleApiService.prototype.addSessionVar = function(_name, _variable, _consoleApiObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].addSessionVar(_name, _variable, _consoleApiObj);
   }
   else {
      return false;
   }
};

ConsoleApiService.prototype.setSessionVar = function(_name, _value, _consoleApiObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].setSessionVar(_name, _variable, _consoleApiObj);
   }
   else {
      return false;
   }
};

ConsoleApiService.prototype.getAllSessionsForConsoleApiObject = function(_consoleApiObj) {
   var allSessions = {};

   for (var session in this.sessions) {

       if (this.sessions.hasOwnProperty(session)) {

          if (this.sessions[session].consoleApiObjVars.hasOwnProperty(_consoleApiObj.uName)) {
             allSessions[session] = this.sessions[session].consoleApiObjVars[_consoleApiObj.uName];
          }
       }
   }

   return allSessions;
};

ConsoleApiService.prototype.getSession = function(_id, _consoleApi) {

   if (!this.sessions.hasOwnProperty(_id)) {
      console.log(this.uName + ': Creating new session for consoleApi ' + _id);
      this.sessions[_id] = new ConsoleApiSession(_id, _consoleApi, this);
   }

   return this.sessions[_id];
};

ConsoleApiService.prototype.writeOutput = function(_sessionId, _output) {

   if (this.sessions.hasOwnProperty(_sessionId)) {
      this.sessions[_sessionId].writeOutput(_output);
   }
};

ConsoleApiService.prototype.socketIoConnection = function(_socket) {
   console.log(this.uName + ': a consoleApi client has joined');
   this.sessions[_socket.id] = new ConsoleApiSession(_socket.id+Date.now(), null, this);
   this.sessions[_socket.id].serveClient(_socket);
};

function ConsoleApiSession(_id, _console, _owner) {
   this.uName = _id;
   this.console = _console;
   this.owner = _owner;
   this.consoleApiObjVars = {};
}

ConsoleApiSession.prototype.serveClient = function(_socket) {
   this.socket = _socket;

   this.socket.on('scopeExists', (_data) => {
      this.scopeExists(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('scope-exists-output', _result);
      });
   });

   this.socket.on('parseLine', (_data) => {
      this.parseLine(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('parse-output', { result: _result });
      });
   });

   this.socket.on('completeLine', (_data) => {
      this.completeLine(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('complete-output', { result: _result });
      });
   });

   this.socket.on('executeCommand', (_data) => {
      this.executeCommand(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('execute-output', { result: util.inspect(_result) });
      });
   });

   this.socket.on('disconnect', (_data) => {

      if (!this.closed) {
         this.closed = true;
         this.sessionClosed();
      }
   });

   this.socket.on('error', (_data) => {

      if (!this.closed) {
         this.closed = true;
         this.sessionClosed();
      }
   });
};

ConsoleApiSession.prototype.getSessionVar = function(_name, _consoleApiObjId) {
   var consoleApiObj = this.consoleApiObjVars[_consoleApiObjId];

   if (consoleApiObj) {
      return consoleApiObj[_name];
   }
   else {
      return null;
   }
};

ConsoleApiSession.prototype.addSessionVar = function(_name, _variable, _consoleApiObj) {

   if (!this.consoleApiObjVars.hasOwnProperty(_consoleApiObj.uName)) {
      this.consoleApiObjVars[_consoleApiObj.uName] = { consoleApiObj: _consoleApiObj };
   }

   this.consoleApiObjVars[_consoleApiObj.uName][_name] = _variable;
};

ConsoleApiSession.prototype.setSessionVar = function(_name, _value, _consoleApiObj) {

   if (!this.consoleApiObjVars.hasOwnProperty(_consoleApiObj.uName)) {
      return false;
   }

   this.consoleApiObjVars[_consoleApiObj.uName][_name] = _value;
   return true;
};

ConsoleApiSession.prototype.performOneShotHttpRequest = function(_command, _request, _response) {
   var fTable = { scoopeExists: ConsoleApiSession.prototype.scopeExists,
                  parseLine: ConsoleApiSession.prototype.parseLine,
                  completeLine: ConsoleApiSession.prototype.completeLine,
                  executeLine: ConsoleApiSession.prototype.executeLine };

   if (fTable.hasOwnProperty(_command)) {
      fTable.call(this, _request.params, (_err, _result) => {

         if (_err) {
            this.owner.sendFail(_request, _response);
         }
         else {
            _response.send(_result);
         }

         this.sessionClosed();
         delete this;
      });
   }
   else {
      this.owner.sendFail(_request, _response);
      this.sessionClosed();
      delete this;
   }
};

ConsoleApiSession.prototype.scopeExists = function(_params, _callback) {
   var scope;
   var newScope;
   var line = _params.line;

   if ((line !== ":") && (line !== "::")) {
      line = _params.line.substr(0, _params.line.length - 1);
   }

   if ((line.length >= 1) && (line[0] === ':')) {
      scope = (line === "::") ? line.replace("::", this.owner.gang.uName) : (line === ":") ? this.owner.gang.uName + ":" + this.owner.gang.casa.uName : line.replace(":", this.owner.gang.uName);
      newScope = (line === ":") ? "::" + this.owner.gang.casa.uName : line;
   }
   else {
      scope = (_params.scope === "::") ? this.owner.gang.uName + ":" + line : this.owner.gang.uName + _params.scope.substr(1) + ":" + line;
      newScope = (_params.scope === "::") ? "::" + line : _params.scope + ":" + line;
   }

   _callback(null, { exists: this.owner.globalConsoleApi.filterScope(scope).consoleApiObj != null, newScope: newScope });
};

ConsoleApiSession.prototype.processMatches = function(_currentScope, _line, _matches) {
   var scope = (_currentScope === "::") ? this.owner.gang.uName : this.owner.gang.uName + _currentScope.substr(1);

   for (var i = 0; i < _matches.length; ++i) {

      if (_line[0] === ':') {
         _matches[i] = (_line[1] === ':') ? "::"+_matches[i].substr(this.owner.gang.uName.length+1) : ":"+_matches[i].replace(this.owner.gang.uName+":"+this.owner.gang.casa.uName, "").substr(1);
      }
      else  {
         _matches[i] = _matches[i].replace(scope, "").substr(1);
      }
   }
};

ConsoleApiSession.prototype.splitLine = function(_currentScope, _line) {
   var line;
   var scope;
   var matchingMethods = [];
   var matchingScopes = [];
   var method = null;
   var arguments = [];
   var result;

   if (_line[0] === ':') {
      line = ((_line.length > 1) && (_line[1] === ":")) ? this.owner.gang.uName + _line.substr(1) : this.owner.gang.uName + ":" + this.owner.gang.casa.uName + _line;
      result = this.owner.globalConsoleApi.filterScope(line.split("(")[0].split(".")[0]);

      if (result.hits.length === 0) {
         line = ((_line.length > 1) && (_line[1] === ":")) ? this.owner.gang.uName + "." + _line.substr(2) : this.owner.gang.uName + ":" + this.owner.gang.casa.uName + "." + _line.substr(1);
         result = this.owner.globalConsoleApi.filterScope(line.split(".")[0]);
      }
   }
   else  {
      if (_currentScope === "::") {
         line = this.owner.gang.uName + ":" + _line;
      }
      else if (_currentScope.startsWith("::")) {
         line = this.owner.gang.uName + _currentScope.substr(1) + ":" + _line;
      }

      result = this.owner.globalConsoleApi.filterScope(line.split("(")[0].split(".")[0]);

      if (result.hits.length === 0) {

         if (_currentScope === "::") {
            line = this.owner.gang.uName + "." + _line;
         }
         else if (_currentScope.startsWith("::")) {
            line = this.owner.gang.uName + _currentScope.substr(1) + "." + _line;
         }
         result = this.owner.globalConsoleApi.filterScope(line.split(".")[0]);
      }
   }

   if (result.hits.length === 0) {
      return { scope: null, matchingScopes: [], matchingMethods: [], method: null, arguments: [] };
   }

   matchingScopes = result.hits;
   scope = result.hits[0];
   this.processMatches(_currentScope, _line, matchingScopes);
   
   if (result.consoleApiObj && (line.split("(")[0].split(".").length > 1)) {
      var m = line.split("(")[0].split(".")[1];
      matchingMethods = result.consoleApiObj.filterMembers(m);

      if (matchingMethods.length === 0) {
         return (line.indexOf("(") === -1) ? { scope: scope, matchingScopes: matchingScopes, matchingMethods: [] }
                                           : { scope: scope, matchingScopes: matchingScopes, matchingMethods: [], method: null, consoleApiObj: result.consoleApiObj };
      }

      if ((scope + "." + m) === matchingMethods[0]) {
         method = m;
      }

      this.processMatches(_currentScope, _line, matchingMethods);
   }

   if (method && (line.split("(").length > 1)) {
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

   return { scope: scope, matchingScopes: matchingScopes, matchingMethods: matchingMethods, method: method, arguments: arguments, consoleApiObj: result.consoleApiObj };
};

ConsoleApiSession.prototype.parseLine = function(_params, _callback) {
   var result = this.splitLine(_params.scope, _params.line);

   if (result.consoleApiObj) {
      var hierarchy = util.getClassHierarchy(result.consoleApiObj);
      result.consoleObjHierarchy = [];

      for (var i = 0; i < hierarchy.length; ++i) {

         if (hierarchy[i] === 'consoleapi') {
            break;
         }
         else {
            result.consoleObjHierarchy.push(hierarchy[i].replace("api", ""));
         }
      }
     
      delete result.consoleApiObj;
   }

   if (_callback) {
      _callback(null, result);
   }
   else {
     return result;
   }
};

ConsoleApiSession.prototype.completeLine = function(_params, _callback) {
   var result = this.splitLine(_params.scope, _params.line);

   var results = (result.matchingMethods.length === 0) ? result.matchingScopes : result.matchingMethods;

   if (_callback) {
      _callback(null, [ results, _params.line]);
   }
   else {
     return [ results, _params.line ];
   }
};


ConsoleApiSession.prototype.executeCommand = function(_params, _callback) {
   var result = this.splitLine(_params.scope, _params.line);
   var outputOfEvaluation = "Object not found!";

   if (result.scope && result.consoleApiObj) {

      if (result.method) {
         this.owner.setCurrentSession(this);
      
         try {
            Object.getPrototypeOf(result.consoleApiObj)[result.method].call(result.consoleApiObj, result.arguments, _callback);
            this.owner.setCurrentSession(null);
         }
         catch (_err) {
            this.owner.setCurrentSession(null);
            _callback(_err);
         }
      }
      else if (result.matchingScopes.length > 0) {
         this.owner.setCurrentSession(this);
         outputOfEvaluation = result.consoleApiObj.cat();
         this.owner.setCurrentSession(null);
         _callback(null, outputOfEvaluation);
      }
      else {
         _callback("Method not found!");
      }
   }
   else {
      _callback(outputOfEvaluation);
   }
};

ConsoleApiSession.prototype.writeOutput = function(_output) {

   if (this.console) {
      this.console.writeOutput(_output);
   }
   else if (this.socket) {
      this.socket.emit('output', { result: _output });
   }
};

ConsoleApiSession.prototype.sessionClosed = function() {

   for (var consoleApiObjVars in this.consoleApiObjVars) {

      if (this.consoleApiObjVars.hasOwnProperty(consoleApiObjVars)) {
         this.consoleApiObjVars[consoleApiObjVars].consoleApiObj.sessionClosed(this.consoleApiObjVars[consoleApiObjVars]);
      }
   }
   delete this.owner.sessions[this.uName];
};

module.exports = exports = ConsoleApiService;
