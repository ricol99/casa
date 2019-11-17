var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function ConsoleService(_config) {
   WebService.call(this, _config);

   if (this.gang.inSecureMode()) {
      var fs = require('fs');
      this.http = "https";
      this.socketOptions = {
         secure: true,
         rejectUnauthorized: false,
         key: fs.readFileSync(this.gang.certPath()+'/client.key'),
         cert: fs.readFileSync(this.gang.certPath()+'/client.crt'),
         ca: fs.readFileSync(this.gang.certPath()+'/ca.crt'),
         json: true
      };
   }
   else {
      this.http = "http";
      this.socketOptions = { json: true };
   }

   var GangConsoleObj = this.gang.cleverRequire("gangconsole:"+this.gang.uName.split(":")[1], "consoles");
   this.gangConsole = new GangConsoleObj(this.gang.uName);
}

util.inherits(ConsoleService, WebService);

ConsoleService.prototype.coldStart = function() {

   this.addRoute('/console/completeLine/:scope', ConsoleService.prototype.completeLineRequest.bind(this));
   this.addRoute('/console/executeLine/:line', ConsoleService.prototype.executeLineRequest.bind(this));

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
      _response.send(this.completeLine(_request.params.line));
   }
};

ConsoleService.prototype.executeLineRequest = function(_request, _response) {
   console.log(this.uName+": executeLineRequest() request=", _request.params);

   if (!_request.params.hasOwnProperty("line")) {
      this.sendFail(_request, _response);
   }
   else {
      _response.send(this.executeLine(_request.params.line));
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

ConsoleService.prototype.completeLine = function(_line) {
   var dotSplit = _line.split(".");

   var result = this.gangConsole.filterScope(dotSplit[0].split(":"), 0);

   if (_line.indexOf(".") !== -1  && result.consoleObj) {
       dotSplit.splice(0, 1);
       result.hits = result.consoleObj.filterMembers(dotSplit);
   }

   return [ result.hits, _line];
};

ConsoleService.prototype.executeLine = function(_line) {
   var dotSplit = _line.split(".");
   var result = this.gangConsole.filterScope(dotSplit[0].split(":"), 0);

   if (_line.indexOf(".") !== -1 && result.consoleObj) {
       var i = 0;
       dotSplit.splice(0, 1);
       var outputOfEvaluation = result.consoleObj;

       try {
          outputOfEvaluation = eval("outputOfEvaluation."+dotSplit[0]);

          while (typeof outputOfEvaluation === 'object' && dotSplit.length > 1) {
             dotSplit.splice(0, 1);
             outputOfEvaluation = eval("outputOfEvaluation."+dotSplit[0]);
          }

          if (outputOfEvaluation) {

             if (typeof outputOfEvaluation === 'object' || outputOfEvaluation instanceof Array) {
                return util.inspect(outputOfEvaluation);
             }
             else {
                return outputOfEvaluation.toString();
             }
          }
          else {
             return outputOfEvaluation;
          }
      }
      catch (_err) {
         return "Unable to process command!";
      }
   }
   else if (result.consoleObj) {
      return util.inspect(result.consoleObj.cat());
   }
   else {
      return "Object not found!";
   }
};

module.exports = exports = ConsoleService;
