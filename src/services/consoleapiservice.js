var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function ConsoleApiService(_config) {
   _config.socketIoSupported = true;
   WebService.call(this, _config);

   var GangConsoleApiObj = this.gang.cleverRequire("gangconsoleapi:"+this.gang.uName.split(":")[1], "consoleapis");
   this.gangConsoleApi = new GangConsoleApiObj({ uName: this.gang.uName});
   this.sessions = {};
}

util.inherits(ConsoleApiService, WebService);

ConsoleApiService.prototype.coldStart = function() {

   this.addRoute('/consoleapi/scopeExists/:scope', ConsoleApiService.prototype.scopeExistsRequest.bind(this));
   this.addRoute('/consoleapi/completeLine/:scope/:line', ConsoleApiService.prototype.completeLineRequest.bind(this));
   this.addRoute('/consoleapi/executeCommand/:scope/:method/:arguments', ConsoleApiService.prototype.executeCommandRequest.bind(this));
   this.addIoRoute('/consoleapi/io', ConsoleApiService.prototype.socketIoConnection.bind(this));

   WebService.prototype.coldStart.call(this);
};

ConsoleApiService.prototype.getGangConsoleApi = function() {
   return this.gangConsoleApi;
};

ConsoleApiService.prototype.scopeExistsRequest = function(_request, _response) {
   console.log(this.uName+": scopeExistsRequest() request=", _request.params);
   
   if (!_request.params.hasOwnProperty("scope")) {
      this.sendFail(_request, _response);
   }
   else { 
      var id = "oneshotconsoleapiesession:"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('scopeExists', _request, _response);
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

   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("method")) {
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
         this.socket.emit('scope-exists-output', { result: _result });
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
   _callback(null, this.owner.gangConsoleApi.filterScope(_params.scope).consoleApiObj != null);
};

ConsoleApiSession.prototype.completeLine = function(_params, _callback) {
   var dotSplit = _params.line.split(".");

   if (_params.hasOwnProperty('scope') && _params.line[0] !== ':') {
      var scope = _params.scope + ":" + dotSplit[0];
      var result = this.owner.gangConsoleApi.filterScope(scope);

      if (_params.line.indexOf(".") !== -1 && result.consoleApiObj) {
         result.hits = result.consoleApiObj.filterMembers(dotSplit[1]);
      }

      var result2 = this.owner.gangConsoleApi.filterScope(_params.scope);

      if (result2.consoleApiObj) {
         result2.hits = result2.consoleApiObj.filterMembers(_params.line);
      }

      result.hits = result.hits.concat(result2.hits);
   }
   else {
      var result = this.owner.gangConsoleApi.filterScope(dotSplit[0]);

      if (_params.line.indexOf(".") !== -1 && result.consoleApiObj) {
         result.hits = result.consoleApiObj.filterMembers(dotSplit[1]);
      }
   }

   _callback(null, [ result.hits, _params.line]);
};

ConsoleApiSession.prototype.executeCommand = function(_params, _callback) {
   var result = this.owner.gangConsoleApi.filterScope(_params.scope);
   var outputOfEvaluation =   "Object not found!";

   if (_params.hasOwnProperty("method") && result.consoleApiObj) {
      var matchingMethods = result.consoleApiObj.filterMembers(_params.method);

      if (!matchingMethods || matchingMethods.length == 0) {

         if (!_params.hasOwnProperty("arguments") || (_params.arguments.length === 0)) {
             var newResult = this.owner.gangConsoleApi.filterScope( _params.scope + ":" + _params.method);

             if (newResult.consoleApiObj) {
                this.owner.setCurrentSession(this);
                outputOfEvaluation = newResult.consoleApiObj.cat();
                this.owner.setCurrentSession(null);
                _callback(null, outputOfEvaluation);
             }
             else {
                _callback("Method not found!");
             }
         }
         else {
             _callback("Method not found!");
         }
         return;
      }

      this.owner.setCurrentSession(this);

      try {
         outputOfEvaluation =  Object.getPrototypeOf(result.consoleApiObj)[_params.method].apply(result.consoleApiObj, _params.arguments);
         this.owner.setCurrentSession(null);
      }
      catch (_err) {
         this.owner.setCurrentSession(null);
         outputOfEvaulation  = _err;
      }
   }
   else if (result.consoleApiObj) {
      this.owner.setCurrentSession(this);
      outputOfEvaluation = result.consoleApiObj.cat();
      this.owner.setCurrentSession(null);
   }

   _callback(null, outputOfEvaluation);
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
