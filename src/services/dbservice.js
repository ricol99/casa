var util = require('util');
var WebService = require('./webservice');
var request = require('request');

function DbService(_config, _owner) {
   WebService.call(this, _config, _owner);

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
}

util.inherits(DbService, WebService);

DbService.prototype.coldStart = function() {

   this.addRoute('/db/:dbName', DbService.prototype.dbRequested.bind(this));
   this.addRoute('/dbhash/:dbName/:peerHash', DbService.prototype.dbHashRequested.bind(this));
   this.addRoute('/dbs', DbService.prototype.dbsRequested.bind(this));

   this.addRoute('/scene/:sceneName', DbService.prototype.sceneRequested.bind(this));
   this.addRoute('/scenes', DbService.prototype.scenesRequested.bind(this));

   this.addRoute('/service/:serviceName', DbService.prototype.serviceRequested.bind(this));
   this.addRoute('/services', DbService.prototype.servicesRequested.bind(this));

   this.addRoute('/thing/:thingName', DbService.prototype.thingRequested.bind(this));
   this.addRoute('/things', DbService.prototype.thingsRequested.bind(this));

   WebService.prototype.coldStart.call(this);
};

DbService.prototype.dbRequested = function(_request, _response) {
   console.log(this.uName+": dbRequested() request=", _request.params);

   if (!_request.params.hasOwnProperty("dbName")) {
      this.sendFail(_request, _response);
   }
   else {
      this.gang.getDb(_request.params.dbName, { request: _request, response: _response }, (_err, _result, _data) => {

         if (_err) {
            this.sendFail(_data.request, _data.response);
         }
         else {
            _result.readAll((_err, _docs) => {

               if (_err) {
                  this.sendFail(_data.request, _data.response);
               }
               else {
                  _data.response.send(_docs);
               }
            });
         }
      });
   }
};

DbService.prototype.dbHashRequested = function(_request, _response) {
   console.log(this.uName+": dbHashRequested() request=", _request.params);

   if (!_request.params.hasOwnProperty("dbName") || ((_request.params.dbName !== this.gang.uName) && (_request.params.dbName !== this.gang.casa.uName))) {
      this.sendFail(_request, _response);
   }
   else {
      var hash = this.getDbHash(_request.params.dbName);

      if (_request.params.hasOwnProperty("peerHash") && (hash.hash !== _request.params.peerHash)) {
         console.log('AAAAAAAAAAAAA OH DEAR!!!!!!!!');
      }

      if (!hash) {
         this.sendFail(_request, _response);
      }
      else {
         _response.send(hash);
      }
   }
};

DbService.prototype.sceneRequested = function(_request, _response) {
   console.log(this.uName+": sceneRequested() request=", _request.params);
};

DbService.prototype.scenesRequested = function(_request, _response) {
   console.log(this.uName+": scenesRequested() request=", _request.params);

   if (_request.params.hasOwnProperty("scenes")) {
      var allProps = {};
      var source = this.gang.findNamedObject(_request.params.source);

      if (source) {
         source.getAllProperties(allProps);
      }

      _response.json(allProps);
   }
   else {
      this.sendFail(_request, _response);
   }
};

DbService.prototype.serviceRequested = function(_request, _response) {
   console.log(this.uName+": serviceRequested() request=", _request.params);
};

DbService.prototype.servicesRequested = function(_request, _response) {
   console.log(this.uName+": servicesRequested() request=", _request.params);
};

DbService.prototype.thingRequested = function(_request, _response) {
   console.log(this.uName+": thingRequested() request=", _request.params);

   if (_request.params.hasOwnProperty("thingName")) {
      var allProps = {};
      var thing = this.gang.findNamedObject(_request.params.thingName);

      if (thing) {
         thing.getAllProperties(allProps);
         _response.json({config: thing.config, currentPropState: allProps });
      }
      else {
         this.sendFail(_request, _response);
      }
   }
   else {
      this.sendFail(_request, _response);
   }
};

DbService.prototype.thingsRequested = function(_request, _response) {
   console.log(this.uName+": thingsRequested() request=", _request.params);

   var names = [];

   for (var thingName in this.gang.casa.sources) {

      if (this.gang.casa.sources.hasOwnProperty(thingName)) {
         names.push(thingName);
      }
   }

   _response.json(names);
};

DbService.prototype.getDbHash = function(_dbName) {
   var db = this.gang.getDb(_dbName);
   return db.getHash();
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

 
DbService.prototype.checkGangDbAgainstPeer = function(_address, _port, _callback) {
   var localHash = this.getDbHash(this.gang.uName);

   this.getPeerDbHash(this.gang.uName, localHash.hash, _address, _port, (_err, _peerHash) => {

      if (_err) {
         _callback("Unable to retrieve peer db hash, err: " + _err);
      }
      else if (_peerHash.hash === localHash.hash) {
         // Dbs are the same!
         _callback(null, { identical: true });
      }
      else {
         _callback(null, { identical: false, localNewer: (localHash.lastModified >= _peerHash.lastModified) });
      }
   });
};

DbService.prototype.updateGangDbFromPeer = function(_address, _port, _callback) {

   this.getPeerDb(this.gang.uName, _address, _port, (_err, _docs) => {

      if (_err) {
         _callback("Unable to retrieve peer db, err: " + _err);
      }
      else {
         var Db = require('../db');
         this.gang.gangDb = new Db(this.gang.uName, this.gang.configPath(), true);

         this.gang.gangDb.on('connected', () => {
            this.gang.gangDb.append(_docs, _callback);
         });

         this.gang.gangDb.on('connect-error', (_data) => {
            return _callback(_data.error);
         });

         this.gang.gangDb.connect();
      }
   });
};

DbService.prototype.getPeerDbHash = function(_dbName, _localHash, _address, _port, _callback) {
   var hash = (_localHash) ? "/" + _localHash : "";
   request(this.http + "://" + _address + ":" + _port + "/dbhash/" + _dbName + hash, this.socketOptions, (_err, _res, _body) => {

      if (_err) {
         return _callback(_err);
      }

      _callback(null, _body);
   });
};

DbService.prototype.getPeerDb = function(_dbName, _address, _port, _callback) {

   request(this.http + "://" + _address + ":" + _port + "/db/" + _dbName, this.socketOptions, (_err, _res, _body) => {

      if (_err || _body.hasOwnProperty("error")) {
         return _callback(_err ? _err : _body.error);
      }

      _callback(null, _body);
   });
};

DbService.prototype.getAndWritePeerDb = function(_dbName, _address, _port, _outputPath, _callback) {

   this.getPeerDb(_dbName, _address, _port, (_err, _docs) => {

      if (_err) {
         return _callback(_err);
      }

      var Db = require('../db');
      var db = new Db(_dbName, _outputPath, true);

      db.on('connected', () => {

         db.append(_docs, (_err, _result) => {
            _callback(_err, true);
         });
      });

      db.connect();
   });
};

module.exports = exports = DbService;
