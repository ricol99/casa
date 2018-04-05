var util = require('./util');
var events = require('events');

function Db(_dbName) {
   this.dbName = _dbName;
   this.uName = "db:"+this.dbName;

   events.EventEmitter.call(this);

   const MongoClient = require('mongodb').MongoClient;
   const url = 'mongodb://localhost:27017/' + this.dbName;
 
   // Use connect method to connect to the server
   MongoClient.connect(url, (_err, _client) => {

     if (_err) {
        console.error(this.uName + ": Unable to connect to DB. Error=", _err);
        process.exit(1);
     }

     console.log(this.uName + ": Connected successfully to DB server");
     this.client = _client;
     this.db = _client.db();
     this.emit('connected');
   });
};

util.inherits(Db, events.EventEmitter);

Db.prototype.close = function(_collectionName) {
   this.client.close();
};

Db.prototype.loadCollection = function(_collectionName) {
   return this.db.collection(_collectionName).find();
};

Db.prototype.writeCollection = function(_collectionName, _config) {

   for (var i = 0; i < _config.length; ++i) {
      _config[i].name = _config[i].hasOwnProperty("name") ? _config[i].name : _config[i].uName;
      _config[i]._id = _config[i].hasOwnProperty("uName") ? _config[i].uName : _config[i].name;
   }

   console.log(this.db);

   this.db.collection(_collectionName, (_err, _collection) => {
      _collection.insert(_config);
   });
};

Db.prototype.load = function(_collectionName, _uName) {
   return this.db.collection(_collectionName).find({ _id: uName });
};

Db.prototype.remove = function(_collectionName, _uName) {
   _config._id = _config.uName;
   return this.db.collection(_collectionName).remove({ _id: _uName });
};

Db.prototype.write = function(_collectionName, _config) {

   if (_config instanceof Array) {

      for (var i = 0; i < _config.length; ++i) {
         _config[i]._id = _config[i].hasOwnProperty("uName") ? _config[i].uName : _config[i].name;
      }
   }
   else {
      _config._id = _config.hasOwnProperty("uName") ? _config.uName : _config.name;
   }

   return this.db.collection(_collectionName).insert(_config);
};

Db.prototype.update = function(_collectionName, _config) {

   if (_config instanceof Array) {

      for (var i = 0; i < _config.length; ++i) {
         _config[i]._id = _config[i].hasOwnProperty("uName") ? _config[i].uName : _config[i].name;
      }
   }
   else {
      _config._id = _config.hasOwnProperty("uName") ? _config.uName : _config.name;
   }

   return this.db.collection(_collectionName).update(_config);
};

module.exports = exports = Db;
