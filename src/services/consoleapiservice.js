var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function ConsoleApiService(_config, _owner) {
   _config.socketIoSupported = true;
   WebService.call(this, _config, _owner);
   this.sessions = {};
}

util.inherits(ConsoleApiService, WebService);

// Called when current state required
ConsoleApiService.prototype.export = function(_exportObj) {
   WebService.prototype.export.call(this, _exportObj);
};

// Called when current state required
ConsoleApiService.prototype.import = function(_importObj) {
   WebService.prototype.import.call(this, _importObj);
};

ConsoleApiService.prototype.coldStart = function() {
   this.start();
   WebService.prototype.coldStart.call(this);
};

ConsoleApiService.prototype.hotStart = function() {
   this.start();
   WebService.prototype.hotStart.call(this);
};

ConsoleApiService.prototype.start = function() {
   this.gangConsoleApi = this.createChild({ name: this.gang.name, type: "gangconsoleapi" }, "consoleapi", null);

   this.addRoute('/consoleapi/scopeExists/:scope/:line', ConsoleApiService.prototype.scopeExistsRequest.bind(this));
   this.addRoute('/consoleapi/extractScope/:scope/:line', ConsoleApiService.prototype.extractScopeRequest.bind(this));
   this.addRoute('/consoleapi/executeCommand/:obj/:method/:arguments', ConsoleApiService.prototype.executeCommandRequest.bind(this));
   this.addIoRoute('/consoleapi/io', ConsoleApiService.prototype.socketIoConnection.bind(this));
};

ConsoleApiService.prototype.getSession = function(_id, _consoleApi) {

   if (!this.sessions.hasOwnProperty(_id)) {
      console.log(this.uName + ': Creating new session for consoleApi ' + _id);
      this.sessions[_id] = new ConsoleApiSession(_id, _consoleApi, this);
   }

   return this.sessions[_id];
};

ConsoleApiService.prototype.scopeExistsRequest = function(_request, _response) {
   console.log(this.uName+": scopeExistsRequest() request=", _request.params);
   
   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else { 
      var id = "oneshotconsoleapiesession-"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('scopeExists', _request, _response);
   }
};

ConsoleApiService.prototype.extractScopeRequest = function(_request, _response) {
   console.log(this.uName+": extractScopeRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("scope") || !_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsoleapiesession-"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('extractScope', _request, _response);
   }
};

ConsoleApiService.prototype.executeCommandRequest = function(_request, _response) {
   console.log(this.uName+": executeCommandRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("obj") || !_request.params.hasOwnProperty("method")) {
      this.sendFail(_request, _response);
   }
   else {
      var id = "oneshotconsoleapisession-"+Date.now();
      this.sessions[id] = new ConsoleApiSession(id, null, this);
      this.sessions[id].performOneShotHttpRequest('executeCommand', _request, _response);
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

ConsoleApiService.prototype.writeOutput = function(_sessionId, _output) {

   if (this.sessions.hasOwnProperty(_sessionId)) {
      this.sessions[_sessionId].writeOutput(_output);
   }
};

ConsoleApiService.prototype.socketIoConnection = function(_socket) {
   console.log(this.uName + ': a consoleApi client has joined');
   var id = _socket.id+Date.now();
   this.sessions[id] = new ConsoleApiSession(id, null, this);
   this.sessions[id].serveClient(_socket);
};

ConsoleApiService.prototype.createConsoleApiObject = function(_uName, _owner) {
   //process.stdout.write("AAAAA createConsoleApiObject() _uName="+_uName+" _owner="+_owner.uName+"\n");
   var namedObject = this.gang.findNamedObject(_uName);
   //process.stdout.write("AAAAA createConsoleApiObject() namedObject="+namedObject+"\n");
   var consoleObj = null;

   if (!namedObject) {
      return null;
   }

   var type = "consoleapi";

   let classList = util.getClassHierarchy(namedObject);

   for (var i = 0; i < classList.length; ++i) {
      var ConsoleApiObj = this.require(classList[i]+"consoleapi", "consoleapi");

      if (ConsoleApiObj) {
         type = classList[i]+"consoleapi";
         break;
      }

      if (classList[i] === "namedobject") {
         break;
      }
   }

   if (!ConsoleApiObj) {
      ConsoleApiObj = require("../consoleapi");
   }

   consoleObj = new ConsoleApiObj({ name: namedObject.name, type: type }, _owner);
   return consoleObj;
};

ConsoleApiService.prototype.findOrCreateConsoleApiObject = function(_namedObject) {
   return this.gangConsoleApi.findOrCreate(_namedObject.uName, ConsoleApiService.prototype.createConsoleApiObject.bind(this));
};

function ConsoleApiSession(_id, _console, _owner) {
   this.name = _id;
   this.console = _console;
   this.owner = _owner;
   this.consoleApiObjs = {};
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

   this.socket.on('extractScope', (_data) => {
      this.extractScope(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('extract-scope-output', { result: _result });
      });
   });

   this.socket.on('executeCommand', (_data) => {
      this.executeCommand(_data, (_err, _result) => {

         if (_err) {
            _result = _err;
         }
         this.socket.emit('execute-output', { result: _result });
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

ConsoleApiSession.prototype.performOneShotHttpRequest = function(_command, _request, _response) {
   var fTable = { scopeExists: ConsoleApiSession.prototype.scopeExists,
                  extractScope: ConsoleApiSession.prototype.extractScope,
                  executeCommand: ConsoleApiSession.prototype.executeCommand };

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

ConsoleApiSession.prototype.processScopeAndLine = function(_scope, _line) {
   var scope;
   var line = _line;

   if ((line !== ":") && (line !== "::") && (line[line.length-1] === ':')) {
      line = _line.substr(0, _line.length - 1);
   }

   if ((line.length >= 1) && (line[0] === ':')) {
      scope = line;
   }
   else {
      scope = (_scope === "::") ? "::" + line : _scope + ":" + line;
   }

   return scope;
};

ConsoleApiSession.prototype.scopeExists = function(_params, _callback) {
   var scope = this.processScopeAndLine(_params.scope, _params.line);
   var obj = this.owner.gang.findNamedObject(scope);
   _callback(null, { exists: obj != null, newScope: scope });
};

ConsoleApiSession.prototype.processMatches = function(_currentScope, _line, _matches) {

   for (var i = 0; i < _matches.length; ++i) {

      if (!((_line.length > 1) && _line.startsWith("::"))) {
         _matches[i] = (_currentScope === "::") ? _matches[i].replace(_currentScope, "") : _matches[i].replace(_currentScope, "").substr(1);
      }
   }
};

ConsoleApiSession.prototype.extractScopeFromLine = function(_currentScope, _line) {
   var shortenedLine = _line, trimmedString = "", method = null, arguments = [], result = {};
   var sepIndex = _line.search(/[. \(]/);

   if (sepIndex !== -1) {
      shortenedLine = _line.substr(0, sepIndex);
      trimmedString = _line.substr(sepIndex);
   }

   var line = (shortenedLine[0] === ':') ? shortenedLine : (_currentScope === "::") ? "::"+ shortenedLine : _currentScope + ":" + shortenedLine;
   var result = this.owner.gang.filterName(line);

   if ((result.hits.length === 0) && !result.namedObject) {
      return { scope: null, matchingScopes: [], method: null,
               consoleApiObj: null, remainingStr: result.remainingStr+trimmedString, arguments: [] };
   }

   var matchingScopes = result.hits;
   this.processMatches(_currentScope, shortenedLine, matchingScopes);

   var scope = result.scope;
   //process.stdout.write("AAAAAA ConsoleApiSession.prototype.extractScopeFromLine() result="+util.inspect(result)+"\n");
   var consoleApiObj = result.namedObject ? this.owner.findOrCreateConsoleApiObject(result.namedObject) : null;
   return { scope: scope, matchingScopes: matchingScopes, consoleApiObj: consoleApiObj, remainingStr: result.remainingStr+trimmedString };
};

ConsoleApiSession.prototype.getClassHierarchy = function(_consoleApiObj) {
   var hierarchy = util.getClassHierarchy(_consoleApiObj);
   var consoleObjHierarchy = [];

   for (var i = 0; i < hierarchy.length; ++i) {

      if (hierarchy[i] === 'consoleapi') {
         break;
      }
      else {
         consoleObjHierarchy.push(hierarchy[i].replace("api", ""));
      }
   }

   return consoleObjHierarchy;
};

ConsoleApiSession.prototype.extractScope = function(_params, _callback) {
   var line = _params.line ? _params.line : "";

   if (!_params.scope) {
      return _callback("Internal error - parameters malformed");
   }

   var result = this.extractScopeFromLine(_params.scope, line);

   if (result.error) {
      return _callback(result.error);
   }

   if (result.consoleApiObj) {

      if (!result.remainingStr) {
         result.remainingStr = "";
      }

      if (result.remainingStr.length === 0) {
         var processedScopeAndLine = this.processScopeAndLine(_params.scope, line);
         result.newScope = processedScopeAndLine.shortScope;
      }

      result.consoleObjHierarchy = this.getClassHierarchy(result.consoleApiObj);
      result.consoleObjuName = result.consoleApiObj.uName;
      result.consoleObjCasaName = result.consoleApiObj.getCasa().name;
      result.sourceCasa = this.owner.casa.name;
      delete result.consoleApiObj;
   }

   if (_callback) {
      _callback(null, result);
   }
   else {
     return result;
   }
};

ConsoleApiSession.prototype.executeCommand = function(_params, _callback) {
   var result = [];

   if (_params.hasOwnProperty("obj")) {
      var obj = this.owner.gang.findNamedObject(_params.obj);

      if (!obj) {
         result.error = "Object not found!";
      }
      else {
         result.consoleApiObj = this.owner.findOrCreateConsoleApiObject(obj);
         result.scope = _params.obj;
         result.method = _params.method;
         result.arguments = _params.arguments;
      }
   }
   else {

      if (!_params.scope || !_params.line) {
         return _callback("Internal error - parameters malformed");
      }
 
      result = this.extractScopeFromLine(_params.scope, _params.line);
   }

   if (result.error) {
      return _callback(result.error);
   }

   var outputOfEvaluation = "Object not found!";

   if (result.scope && result.consoleApiObj) {

      if (result.method) {
         this.consoleApiObjs[result.consoleApiObj.uName] = result.consoleApiObj;
      
         try {
            Object.getPrototypeOf(result.consoleApiObj)[result.method].call(result.consoleApiObj, this, result.arguments, _callback);
         }
         catch (_err) {
            _callback(_err);
         }
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

   for (var consoleApiObj in this.consoleApiObjs) {

      if (this.consoleApiObjs.hasOwnProperty(consoleApiObj)) {

         try {
            this.consoleApiObjs[consoleApiObj].sessionClosed(this);
         }
         catch (_error) {
            console.error(this.owner.uName + ": closing session caused an exception: " + _error);
         }
      }
   }
   delete this.owner.sessions[this.name];
};

module.exports = exports = ConsoleApiService;
