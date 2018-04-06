var util = require('util');
var WebService = require('./webservice');

function DbService(_config) {
   WebService.call(this, _config);
}

util.inherits(DbService, WebService);

DbService.prototype.coldStart = function() {

   this.addRoute('/db/:dbName', DbService.prototype.dbRequested.bind(this));
   this.addRoute('/dbs', DbService.prototype.dbsRequested.bind(this));

   WebService.prototype.coldStart.call(this);
};

DbService.prototype.dbRequested = function(_request, _response) {
   console.log(this.uName+": AAAAAAAAAAAA dbRequested() request=", _request);
   _response.send(_request.params);
};

DbService.prototype.dbsRequested = function(_request, _response) {
   console.log(this.uName+": AAAAAAAAAAAA dbsRequested() request=", _request);
   _response.send(_request.params);
};

module.exports = exports = DbService;
