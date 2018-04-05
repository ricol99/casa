var util = require('./util');
var events = require('events');
var TinyDB = require('tinydb');

function Db(_dbName) {
   this.dbName = _dbName;
   this.uName = "db:"+this.dbName;

   events.EventEmitter.call(this);

   this.db = new TinyDB(this.dbName);
 
   this.db.onReady = function() {
     this.emit('connected');
   }.bind(this);
 
  this.db.onError = function(_error) { 
     console.error(this.uName + ": Unable to connect to DB. Error=", _err);
     process.exit(1);
  }.bind(this);
};

util.inherits(Db, events.EventEmitter);

Db.prototype.close = function(_collectionName) {
   this.db.flush();
   //this.db.close();
};

Db.prototype.readCollection = function(_collectionName, _callback) {
   return this.db.find({ _collection: _collectionName }, _callback);
};

Db.prototype.appendToCollection = function(_collectionName, _config) {

   if (_config instanceof Array) {

      for (var i = 0; i < _config.length; ++i) {
         _config[i]._collection = _collectionName;
         this.db.appendItem(_config[i]);
      }
   }
   else {
      _config._collection = _collectionName;
      this.db.appendItem(_config);
   }
};

Db.prototype.find = function(_uName) {
   return this.db.find({ uName: uName });
};

Db.prototype.remove = function(_uName) {
   return this.db.findByIdAndRemove({ uName: _uName });
};

Db.prototype.update = function(_config, _callback) {
   this.db.find({ uName: _config.uName }, (_err, _res) => {

      if (_err) {
         return _callback(_err);
      }

      if (_res.length > 1) {
         return _callback("Error: multiple matches!");
      }

      var collection = _res[0]._collection;

      this.db.findByIdAndRemove(_res[0]._id, (_err, res) => {

         if (_err) {
            return _callback(_err);
         }

         _callback(this.appendToCollection(collection, _config), true);
      });
   });
};


module.exports = exports = Db;
