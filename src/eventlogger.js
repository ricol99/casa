const util = require('./util');
const fs = require('fs');
const AsyncEmitter = require('./asyncemitter');

var _mainInstance = null;

function EventLogger(_config) {
   this.eventQueue = [];
   this.logFile = null;

   this.logFileName = _config.hasOwnProperty("logFileName") ? _config.logFileName : "event-log";
   this.logging = _config.hasOwnProperty("logging") ? _config.logging : false;
   this.writingLog = false;
   _mainInstance = this;

   AsyncEmitter.call(this);
}

util.inherits(EventLogger, AsyncEmitter);

// Called when current state required
EventLogger.prototype.export = function(_exportObj) {

   if (this.eventQueue.length > 0) {
      _exportObj.asyncEventQueue = this.eventQueue;
   }
};

// Called when current state required
EventLogger.prototype.import = function(_importObj) {

   if (_importObj.hasOwnProperty("asyncEventQueue")) {
      this.eventQueue = util.copy(_importObj.asyncEventQueue);
   }
};

EventLogger.prototype.coldStart = function() {
};

EventLogger.prototype.hotStart = function() {

   if (this.eventQueue.length > 0) {
      this.setAsyncEmitTimer();
   }
};

EventLogger.prototype.logEvent = function(_event) {

   if (this.logging) {
      this.eventQueue.push({ timestamp: Date.now(), event: util.copy(_event)});
      this.logCurrentEventQueue();
   }
};

EventLogger.prototype.logCurrentEventQueue = function() {

   if (!this.logging || this.writingLog || this.eventQueue.length < 10) {
      return;
   }

   this.writingLog = true;

   this.writeLog( (_res, _err) => {
      this.eventQueue = [];
      this.writingLog = false;

      if (_err) {
         this.logging = false;
      }
      else {
         this.logCurrentEventQueue();
      }
   });
};

EventLogger.prototype.writeLog = function(_callback) {

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

EventLogger.prototype.openNewLog = function(_callback) {
   var logStr = "[\n";

   for (var i = 0; i < this.eventQueue.length-1; ++i) {
      logStr += JSON.stringify(this.eventQueue[i]) + ",\n";
   }

   logStr += JSON.stringify(this.eventQueue[this.eventQueue.length-1]);

   fs.open(this.logFileName + Date.now() + ".json", 'wx', (_err, _fd) => {

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

EventLogger.prototype.closeLog = function(_callback) {

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

EventLogger.prototype.closeLogSync = function() {

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

module.exports = exports = EventLogger;
