var util = require('./util');
var fs = require('fs');
var events = require('events');
var Datastore = require('nedb');
var md5 = require('md5');

function Db(_dbName, _dbPath, _newDb) {

   if (_dbPath == undefined) {
      this.dbPath = process.env['HOME']+'/.casa-keys/secure-config/';
   }
   else {
      this.dbPath = _dbPath;
   }

   this.dbName = this.dbPath + "/" + _dbName + ".db";
   this.uName = "db:"+this.dbName;
   events.EventEmitter.call(this);

   if (_newDb) {

      fs.unlink(this.dbName, (_err) => {
         this.connect();
      });
   }
   else {
      this.connect();
   }
}

util.inherits(Db, events.EventEmitter);

Db.prototype.lastModified = function(_callback) {

   fs.stat(this.dbName, (_err, _stats) => {

      if (_err){
         return _callback(_err);
      }
      else {
         return _callback(null, _stats.mtime);
      }
   });
};

Db.prototype.updateHashInternal = function(_callback) {

   this.readAll( (_err, _docs) => {

      if (_err) {
         return _callback(_err);
      }

      this.lastModified( (_err, _lastModified) => {

         if (_err) {
            return _callback(_err);
         }

         this.hash = { hash: md5(JSON.stringify(_docs)), lastModified: _lastModified };
         return _callback(null, this.hash);
      });
   });
};

Db.prototype.getHash = function() {
   return this.hash;
};

Db.prototype.connect = function() {
   this.db = new Datastore({ filename: this.dbName, autoload: true });

   this.updateHashInternal( (_err, _hash) => {
      var eventName = 'connected';
      var data = null;

      if (_err) {
         eventName = 'error';
         data = _err;
      }

      setTimeout( () => {
         this.emit(eventName, data);
      }, 1);
   });
};


Db.prototype.close = function() {
   //this.db.close();
};

Db.prototype.readAll = function(_callback) {
   this.db.find({ _collection: { $exists: true }}, _callback);
};

Db.prototype.readCollection = function(_collectionName, _callback) {
   return this.db.find({ _collection: _collectionName }, _callback);
};

Db.prototype.append = function(_config, _callback) {
   return this.db.insert(_config, _callback);
};

Db.prototype.appendToCollection = function(_collectionName, _config, _callback) {

   if (_config instanceof Array) {

      for (var i = 0; i < _config.length; ++i) {
         _config[i]._collection = _collectionName;
         _config[i]._id = _config[i].uName;
      }
      return this.db.insert(_config, _callback);
   }
   else {
      _config._collection = _collectionName;
      _config._id = _config.uName;
      return this.db.insert(_config, _callback);
   }
};

Db.prototype.find = function(_uName, _callback) {
   return this.db.findOne({ _id: uName }, _callback);
};

Db.prototype.remove = function(_uName, _callback) {
   return this.db.remove({ _id: _uName }, {}, _callback);
};

Db.prototype.update = function(_config, _callback) {
   return db.update({ _id: _config.uName }, _config, {}. _callback);
};


module.exports = exports = Db;
