const fs = require('fs');
const util = require('../util');
const Service = require('../service');

var _mainInstance = null;

function EventLoggingService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.eventQueue = [];
   this.logFile = null;

   this.logFileName = _config.hasOwnProperty("logFileName") ? _config.logFileName : "event-log";
   this.logging = _config.hasOwnProperty("logging") ? _config.logging : false;
   this.logRaisedEvents = _config.hasOwnProperty("logRaisedEvents") ? _config.logRaisedEvents : true;
   this.logReceivedEvents = _config.hasOwnProperty("logReceivedEvents") ? _config.logReceivedEvents : false;

   this.ensurePropertyExists('logging', 'property', { initialValue: this.logging }, _config);
   this.ensurePropertyExists('log-raised-events', 'property', { initialValue: this.logRaisedEvents }, _config);
   this.ensurePropertyExists('log-received-events', 'property', { initialValue: this.logReceivedEvents }, _config);

   this.writingLog = false;
   _mainInstance = this;

}

util.inherits(EventLoggingService, Service);

// Called when current state required
EventLoggingService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
EventLoggingService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

EventLoggingService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

EventLoggingService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

EventLoggingService.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName === "logging") {
      this.logging = _propValue;
   }
   else if (_propName === "log-raised-events") {
      this.logRaisedEvents = _propValue;
   }
   else if (_propName === "log-received-events") {
      this.logReceivedEvents = _propValue;
   }
};

EventLoggingService.prototype.logRaisedEvent = function(_event) {

   if (this.logging && this.logRaisedEvents) {
      this.eventQueue.push({ timestamp: Date.now(), event: util.copy(_event)});
      this.logCurrentEventQueue();
   }
};

EventLoggingService.prototype.logReceivedEvent = function(_receiver, _event) {

   if (this.logging && this.logReceivedEvents) {
      this.eventQueue.push({ timestamp: Date.now(), receiver: _receiver, event: util.copy(_event)});
      this.logCurrentEventQueue();
   }
};

EventLoggingService.prototype.logCurrentEventQueue = function() {

   if (!this.logging || this.writingLog || this.eventQueue.length < 10) {
      return;
   }

   this.writingLog = true;

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

EventLoggingService.prototype.writeLog = function(_callback) {

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

EventLoggingService.prototype.openNewLog = function(_callback) {
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

EventLoggingService.prototype.closeLog = function(_callback) {

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

EventLoggingService.prototype.closeLogSync = function() {

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

module.exports = exports = EventLoggingService;
