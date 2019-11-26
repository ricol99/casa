var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function ConsoleService(_config) {
   _config.socketIoSupported = true;
   WebService.call(this, _config);

   var GangConsoleObj = this.gang.cleverRequire("gangconsole:"+this.gang.uName.split(":")[1], "consoles");
   this.gangConsole = new GangConsoleObj({ uName: this.gang.uName});
   this.sessions = {};
}

util.inherits(ConsoleService, WebService);

ConsoleService.prototype.coldStart = function() {

   this.addRoute('/console/completeLine/:line', ConsoleService.prototype.completeLineRequest.bind(this));
   this.addRoute('/console/executeCommand/:command', ConsoleService.prototype.executeCommandRequest.bind(this));
   this.addIoRoute('/console/io', ConsoleService.prototype.socketIoConnection.bind(this));

   WebService.prototype.coldStart.call(this);
};

ConsoleService.prototype.getGangConsole = function() {
   return this.gangConsole;
};

ConsoleService.prototype.completeLineRequest = function(_request, _response) {
   console.log(this.uName+": completeLineRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsolesession:"+Date.now();
      this.sessions[id] = new ConsoleSession(id, null, this);
      var output = this.sessions[id].completeLine(_request.params.line);
      _response.send(output);
      this.sessions[id].sessionClosed();
      delete this.sessions[id];
   }
};

ConsoleService.prototype.executeCommandRequest = function(_request, _response) {
   console.log(this.uName+": executeCommandRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("command")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsolesession:"+Date.now();
      this.sessions[id] = new ConsoleSession(id, null, this);
      var output = this.sessions[id].executeCommand(_request.params.command);
      _response.send(output);
      this.sessions[id].sessionClosed();
      delete this.sessions[id];
   }
};

ConsoleService.prototype.sendFail = function(_request, _response) {
   _response.status(404);

   if (_request.accepts('json')) {
     _response.send({ error: 'Not found' });
   }
   else {
      _response.type('txt').send('Not found');
   }
};

ConsoleService.prototype.setCurrentSession = function(_session) {

   if (_session) {
      this.currentSessionId = _session.uName;
   }
   else {
      this.currentSessionId = null;
   }
};

ConsoleService.prototype.getCurrentSession = function() {
   return this.sessions[this.currentSessionId];
};

ConsoleService.prototype.getSessionVars = function(_consoleObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].consoleObjVars[_consoleObj.uName];
   }
   else {
      return null;
   }
};

ConsoleService.prototype.getSessionVar = function(_name, _consoleObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].getSessionVar(_name, _consoleObj.uName);
   }
   else {
      return null;
   }
};

ConsoleService.prototype.addSessionVar = function(_name, _variable, _consoleObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].addSessionVar(_name, _variable, _consoleObj);
   }
   else {
      return false;
   }
};

ConsoleService.prototype.setSessionVar = function(_name, _value, _consoleObj) {

   if (this.sessions.hasOwnProperty(this.currentSessionId)) {
      return this.sessions[this.currentSessionId].setSessionVar(_name, _variable, _consoleObj);
   }
   else {
      return false;
   }
};

ConsoleService.prototype.getAllSessionsForConsoleObject = function(_consoleObj) {
   var allSessions = {};

   for (var session in this.sessions) {

       if (this.sessions.hasOwnProperty(session)) {

          if (this.sessions[session].consoleObjVars.hasOwnProperty(_consoleObj.uName)) {
             allSessions[session] = this.sessions[session].consoleObjVars[_consoleObj.uName];
          }
       }
   }

   return allSessions;
};

ConsoleService.prototype.getSession = function(_id, _console) {

   if (!this.sessions.hasOwnProperty(_id)) {
      console.log(this.uName + ': Creating new session for console ' + _id);
      this.sessions[_id] = new ConsoleSession(_id, _console, this);
   }

   return this.sessions[_id];
};

ConsoleService.prototype.writeOutput = function(_sessionId, _output) {

   if (this.sessions.hasOwnProperty(_sessionId)) {
      this.sessions[_sessionId].writeOutput(_output);
   }
};

ConsoleService.prototype.socketIoConnection = function(_socket) {
   console.log(this.uName + ': a console client has joined');
   this.sessions[_socket.id] = new ConsoleSession(_socket.id, null, this);
   this.sessions[_socket.id].serveClient(_socket);
};

function ConsoleSession(_id, _console, _owner) {
   this.uName = _id;
   this.console = _console;
   this.owner = _owner;
   this.consoleObjVars = {};
}

ConsoleSession.prototype.serveClient = function(_socket) {
   this.socket = _socket;

   this.socket.on('completeLine', (_data) => {
      this.socket.emit('complete-output', { result: this.completeLine(_data.line) });
   });

   this.socket.on('executeCommand', (_data) => {
      this.socket.emit('execute-output', { result: this.executeCommand(_data.command) });
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

ConsoleSession.prototype.getSessionVar = function(_name, _consoleObjId) {
   var consoleObj = this.consoleObjVars[_consoleObjId];

   if (consoleObj) {
      return consoleObj[_name];
   }
   else {
      return null;
   }
};

ConsoleSession.prototype.addSessionVar = function(_name, _variable, _consoleObj) {

   if (!this.consoleObjVars.hasOwnProperty(_consoleObj.uName)) {
      this.consoleObjVars[_consoleObj.uName] = { consoleObj: _consoleObj };
   }

   this.consoleObjVars[_consoleObj.uName][_name] = _variable;
};

ConsoleSession.prototype.setSessionVar = function(_name, _value, _consoleObj) {

   if (!this.consoleObjVars.hasOwnProperty(_consoleObj.uName)) {
      return false;
   }

   this.consoleObjVars[_consoleObj.uName][_name] = _value;
   return true;
};

ConsoleSession.prototype.completeLine = function(_line) {
   var dotSplit = _line.split(".");

   var result = this.owner.gangConsole.filterScope(dotSplit[0].split(":"), 0);

   if (_line.indexOf(".") !== -1 && result.consoleObj) {
       dotSplit.splice(0, 1);
       result.hits = result.consoleObj.filterMembers(dotSplit);
   }

   return [ result.hits, _line];
};

ConsoleSession.prototype.executeCommand = function(_command) {
   var result = this.owner.gangConsole.filterScope(_command.scope);
   var outputOfEvaluation =   "Object not found!";

   if (_command.hasOwnProperty("method") && result.consoleObj) {
      var matchingMethods = result.consoleObj.filterMembers(_command.method);

      if (!matchingMethods || matchingMethods.length == 0) {
         return "Method not found!";
      }

      this.owner.setCurrentSession(this);

      try {
         outputOfEvaluation =  Object.getPrototypeOf(result.consoleObj)[_command.method].apply(result.consoleObj, _command.arguments);
         this.owner.setCurrentSession(null);
      }
      catch (_err) {
         this.owner.setCurrentSession(null);
         outputOfEvaulation  = _err;
      }
   }
   else if (result.consoleObj) {
      this.owner.setCurrentSession(this);
      outputOfEvaluation = result.consoleObj.cat();
      this.owner.setCurrentSession(null);
   }

   return outputOfEvaluation;
};

ConsoleSession.prototype.writeOutput = function(_output) {

   if (this.console) {
      this.console.writeOutput(_output);
   }
   else if (this.socket) {
      this.socket.emit('output', { result: _output });
   }
};

ConsoleSession.prototype.sessionClosed = function() {

   for (var consoleObjVars in this.consoleObjVars) {

      if (this.consoleObjVars.hasOwnProperty(consoleObjVars)) {
         this.consoleObjVars[consoleObjVars].consoleObj.sessionClosed(this.consoleObjVars[consoleObjVars]);
      }
   }
};

module.exports = exports = ConsoleService;
