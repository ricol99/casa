var util = require('./util');
var fs = require('fs');
var events = require('events');
var Datastore = require('nedb');
var md5 = require('md5');
var NamedObject = require('./namedobject');

function Db(_dbName, _dbPath, _newDb, _owner) {

   if (_dbPath == undefined) {
      this.dbPath = process.env['HOME']+'/.casa-keys/secure-config/';
   }
   else {
      this.dbPath = _dbPath;
   }
   this.newDb = _newDb;

   this.dbFullName = this.dbPath + "/" + _dbName + ".db";
   this.dbName = _dbName;
   NamedObject.call(this, { name: this.dbName+"-db", type: "db" }, _owner);
}

util.inherits(Db, NamedObject);

// Used to classify the type and understand where to load the javascript module
Db.prototype.superType = function(_type) {
   return "db";
};

// Called when current state required
Db.prototype.export = function(_exportObj) {
   NamedObject.prototype.export.call(this, _exportObj);
   // AAAAA - TODO
};

// Called when current state required
Db.prototype.import = function(_importObj) {
   NamedObject.prototype.import.call(this, _importObj);
   // AAAAA - TODO
}; 
   
Db.prototype.coldStart = function() {
   NamedObject.prototype.coldStart.call(this);
   // AAAAA - TODO
};
   
Db.prototype.hotStart = function() {
   NamedObject.prototype.hotStart.call(this);
   // AAAAA - TODO
};

Db.prototype.getCasa = function() {
   return this.owner.getCasa();
};

Db.prototype.lastModified = function(_callback) {

   fs.stat(this.dbFullName, (_err, _stats) => {

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

   if (this.newDb) {

      fs.unlink(this.dbFullName, (_err) => {
         this.createDb();
      });
   }
   else {

      fs.access(this.dbFullName, fs.F_OK, (_err) => {

         if (_err) {
            this.asyncEmit('connect-error', { error: _err, name: this.dbName });
         }
         else {
            this.createDb();
         }
      });
   }
};

Db.prototype.createDb = function() {
   this.db = new Datastore({ filename: this.dbFullName, autoload: true });

   this.updateHashInternal( (_err, _hash) => {
      var eventName = 'connected';
      var data = { name: this.dbName, db: this };

      if (_err) {
         eventName = 'error';
         data = { name: this.dbName, db: this, error: _err };
      }

      this.asyncEmit(eventName, data);
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
         _config[i]._id = _config[i].name;
      }
      return this.db.insert(_config, _callback);
   }
   else {
      _config._collection = _collectionName;
      _config._id = _config.name;
      return this.db.insert(_config, _callback);
   }
};

Db.prototype.find = function(_name, _callback) {
   return this.db.findOne({ _id: _name }, _callback);
};

Db.prototype.remove = function(_name, _callback) {
   return this.db.remove({ _id: _name }, {}, _callback);
};

Db.prototype.update = function(_config, _callback) {
   return this.db.update({ _id: _config.name }, _config, {}, _callback);
};

Db.export = function(_content) {
   var output  = {};

   for  (var i = 0; i < _content.length; ++i) {
      var collection = _content[i]._collection;

      if (!output.hasOwnProperty(collection)) {
         output[collection] = [];
      }

      delete _content[i]._collection;
      delete _content[i]._id;
      output[collection].push(_content[i]);
   }

   if (output.hasOwnProperty("casa")) {
      output.casa = output.casa[0];
   }

   if (output.hasOwnProperty("gang")) {
      output.gang = output.gang[0];
   }

   return output;
};

module.exports = exports = Db;
