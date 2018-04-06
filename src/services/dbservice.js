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
   console.log(this.uName+": dbRequested() request=", _request.params);

   if (!_request.params.hasOwnProperty("dbName") || ((_request.params.dbName !== this.gang.uName) && (_request.params.dbName !== this.gang.casa.uName))) {
      this.sendFail(_request, _response);
   }
   else {
      var db = (_request.params.dbName === this.gang.uName) ? this.gang.gangDb : this.gang.casaDb;

      if (!db) {
         this.sendFail(_request, _response);
      }
      else {
         db.readAll((_err, _docs) => {
            _response.send(_docs);
         });
      }
   }
};

DbService.prototype.dbsRequested = function(_request, _response) {
   console.log(this.uName+": dbsRequested()");
   _response.send([ this.gang.uName, this.gang.casa.uName ]);
};

DbService.prototype.sendFail = function(_request, _response) {
   _response.status(404);

   if (_request.accepts('json')) {
     _response.send({ error: 'Not found' });
   }
   else {
      _response.type('txt').send('Not found');
   }
};

module.exports = exports = DbService;
