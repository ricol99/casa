const fs = require('fs');
const util = require('../util');
const Service = require('../service');

var _mainInstance = null;

function S3Service(_config, _owner) {
   Service.call(this, _config, _owner);

   this.syncing = _config.hasOwnProperty("syncing") ? _config.syncing : true;
   this.retryLimit = _config.hasOwnProperty("retryLimit") ? _config.retryLimit : 3;
   this.retryDelay = _config.hasOwnProperty("retryDelay") ? _config.retryDelay : 1000;

   this.key = _config.key;
   this.secret = _config.secret;
   this.region = _config.region;

   this.endpoint = _config.hasOwnProperty("endpoint") ? _config.endpoint : null;
   this.sslEnabled = _config.hasOwnProperty("sslEnabled") ? _config.sslEnabled : true;

   this.ensurePropertyExists('syncing', 'property', { initialValue: this.syncing }, _config);

   _mainInstance = this;
   this.syncQueue = [];
   this.busy = false;
}

util.inherits(S3Service, Service);

// Called when current state required
S3Service.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
S3Service.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

S3Service.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

S3Service.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

S3Service.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "syncing") {
      this.syncing = _propValue;
   }
};

S3Service.prototype.uploadFile = function(_filename) {

   if (this.syncing) {
      this.syncQueue.push({ timestamp: Date.now(), filename: _filename, action: "upload" });
      this.pokeQueue();
   }
};

S3Service.prototype.pokeQueue = function() {

   if (!this.syncing || this.busy || this.eventQueue.length == 0) {
      return;
   }

   this.busy = true;

   this.writeLog( (_res, _err) => {
      this.eventQueue = [];
      this.writingLog = false;

      if (_err) {
         this.logging = false;
         this.alignPropertyValue("logging", this.logging);
      }
      else {
         this.logCurrentEventQueue();
      }
   });
};

S3Service.prototype.writeLog = function(_callback) {

   if (!this.logFile) {
      return this.openNewLog(_callback);
   }
   else if ((Date.now() - this.lastLogOpenDate) > 86400000) {

      this.closeLog( (_err) => {

         if (_err) {
            return _callback(null, _err);
         }

         return this.openNewLog(_callback);
      });
   }
   else {
      var logStr = ",\n";

      for (var i = 0; i < this.eventQueue.length-1; ++i) {
         logStr += JSON.stringify(this.eventQueue[i]) + ",\n";
      }

      logStr += JSON.stringify(this.eventQueue[this.eventQueue.length-1]);

      fs.appendFile(this.logFile, logStr, (_err) => {

         if (_err) {
            console.error("*Event Logger unable to write to log");
            return _callback(null, "*Event Logger unable to write to log");
         }

         return _callback(true);
      });
   }
};

S3Service.prototype.openNewLog = function(_callback) {
   var logStr = "[\n";

   for (var i = 0; i < this.eventQueue.length-1; ++i) {
      logStr += JSON.stringify(this.eventQueue[i]) + ",\n";
   }

   logStr += JSON.stringify(this.eventQueue[this.eventQueue.length-1]);

   fs.open(this.logFileName + "-" + Date.now() + ".json", 'wx', (_err, _fd) => {

      if (_err) {
         console.error("*Event Logger unable to open log");
         return _callback(null, "*Event Logger unable to open log");
      }

      this.logFile = _fd;
      this.lastLogOpenDate = Date.now();

      fs.appendFile(this.logFile, logStr, (_err) => {

         if (_err) {
            console.error("*Event Logger unable to write to log");
            return _callback(null, "*Event Logger unable to write to log");
         }

         return _callback(true);
      });
   });
};

S3Service.prototype.closeLog = function(_callback) {

   fs.appendFile(this.logFile, "\n]\n", (_err) => {
         
      if (_err) {
         console.error("*Event Logger unable to write to log");
         return _callback(null, "*Event Logger unable to write to log");
      }

      fs.close(this.logFile, (_err) => {

         if (_err) {
            console.error("*Event Logger unable to close log");
            return _callback(null, "*Event Logger unable to close log");
         }

         this.logFile = null;

         return _callback(true);
      });
   });
};

S3Service.prototype.closeLogSync = function() {

   if (this.logFile) {

      if (this.eventQueue.length > 0) {
         var logStr = ",\n";

         for (var i = 0; i < this.eventQueue.length-1; ++i) {
            logStr += JSON.stringify(this.eventQueue[i]) + ",\n";
         }

         logStr += JSON.stringify(this.eventQueue[this.eventQueue.length-1]) + "\n]\n";
         fs.appendFileSync(this.logFile, logStr);
      }
      else {
         fs.appendFileSync(this.logFile, "\n]\n");
      }

      fs.closeSync(this.logFile);
   }
};

process.on('exit', () => {

   if (_mainInstance) {
      _mainInstance.closeLogSync();
   }
});

module.exports = exports = S3Service;
