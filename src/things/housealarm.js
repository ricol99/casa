var util = require('util');
var Thing = require('../thing');
var net = require('net');

var STATE_STAY_ARM = 0;
var STATE_AWAY_ARM = 1;
var STATE_NIGHT_ARM = 2;
var STATE_DISARMED = 3;
var STATE_ALARM_TRIGGERED = 4;

function HouseAlarm(_config, _parent) {

   Thing.call(this, _config, _parent);

   this.ensurePropertyExists('max-retries', 'property', { initialValue: _config.hasOwnProperty("maxRetries") ? _config.maxRetries : 2 }, _config);
   this.ensurePropertyExists('retry-count', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('retry-allowed', 'evalproperty', { initialValue: true,
                                                                sources: [{ property: "retry-count" }, { property: "max-retries" }],
                                                                expression: "($values[0] < $values[1])" }, _config);

   // Secure config
   this.transactionTarget = REQUEST_STATE_IDLE;

   this.ensurePropertyExists('target-state', 'property', { initialValue: STATE_DISARMED }, _config);
   this.ensurePropertyExists('current-state', 'property', { initialValue: STATE_DISARMED }, _config);

   this.ensurePropertyExists('line-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('ac-power-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('battery-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('medical-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('panic-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('duress-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('attack-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('carbon-monoxide-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('armed-normal', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('part-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('stay-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('night-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('away-armed', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' }, _config);

   this.ensurePropertyExists('arm-type-state', 'stateproperty', { name: "arm-type-state", type: "stateproperty", ignoreControl: true, takeControlOnTransition: true, initialValue: "none",
                                                                  states: [{ name: "none",
                                                                             sources: [{ property: "target-state", property: "stay-armed", nextState: "pre-stay" },
                                                                                       { property: "target-state", property: "away-armed", nextState: "pre-away" },
                                                                                       { property: "target-state", property: "night-armed", nextState: "pre-night" }]},
                                                                           { name: "pre-stay",
                                                                             actions: [{ property: "arming-timeout", fromProperty: "stay-arming-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "stay-triggered-timeout" },
                                                                                       { property: "disarming-timeout", fromProperty: "stay-disarming-timeout" }],
                                                                             timeout: [{ duration: 0.1, nextState: "stay" }]},
                                                                           { name: "pre-away",
                                                                             actions: [{ property: "arming-timeout", fromProperty: "away-arming-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "away-triggered-timeout" },
                                                                                       { property: "disarming-timeout", fromProperty: "away-disarming-timeout" }],
                                                                             timeout: [{ duration: 0.1, nextState: "away" }]},
                                                                           { name: "pre-night",
                                                                             actions: [{ property: "arming-timeout", fromProperty: "night-arming-timeout" },
                                                                                       { property: "triggered-timeout", fromProperty: "night-triggered-timeout" },
                                                                                       { property: "disarming-timeout", fromProperty: "night-disarming-timeout" }],
                                                                             timeout: [{ duration: 0.1, nextState: "night" }]},
                                                                           { name: "stay",
                                                                             sources: [{ property: "alarm-state", property: "disarmed", nextState: "none" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] },
                                                                           { name: "away",
                                                                             sources: [{ property: "alarm-state", property: "disarmed", nextState: "none" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] },
                                                                           { name: "night",
                                                                             sources: [{ property: "alarm-state", property: "disarmed", nextState: "none" }],
                                                                             actions: [{ property: "target-arm-state", value: "armed" }] }] }, _config);

   this.ensurePropertyExists('arm-state', 'stateproperty', { name: "arm-state", ignoreControl: true, takeControlOnTransition: true, type: "stateproperty", initialValue: "disarmed",
                                                             states: [{ name: "disarmed",
                                                                        sources: [{ property: "target-arm-state", value: "armed", nextState: "arming" }],
                                                                        actions: [{ property: "retry-count", value: 0 }]},
                                                                      { name: "arming",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "disarm-immediate" }],
                                                                        timeout" { property: "arming-timeout", nextState: "armed" }},
                                                                      { name: "armed",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "disarming" },
                                                                                  { property: "target-arm-state", value: "triggered", nextState: "triggered" }]},
                                                                      { name: "disarming",
                                                                        actions: [{ property: "target-arm-state", value: "disarmed" }],
                                                                        timeout" { property: "disarming-timeout", nextState: "disarmed" }},
                                                                      { name: "disarm-immediate",
                                                                        actions: [{ property: "target-arm-state", value: "disarmed" }],
                                                                        timeout" { duration: 0.1, nextState: "disarmed" }},
                                                                      { name: "triggered",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "disarm-immediate" },
                                                                                  { property: "target-state", value: "stay-armed", nextState: "reset-to-armed" },
                                                                                  { property: "target-state", value: "away-armed", nextState: "reset-to-armed" },
                                                                                  { property: "target-state", value: "night-armed", nextState: "reset-to-armed" }],
                                                                        actions: [{ property: "retry-count", apply: "++$value" }],
                                                                        timeout" { property: "triggered-timeout", nextState: "triggered-timed-out" }},
                                                                      { name: "reset-to-armed",
                                                                        sources: [{ property: "target-arm-state", value: "armed", nextState: "armed" }],
                                                                        actions: [{ property: "target-arm-state", value: "armed" }]},
                                                                      { name: "triggered-timed-out",
                                                                        sources: [{ property: "retry-allowed", value: true, nextState: "armed" },
                                                                                  { property: "retry-allowed", value: false, nextState: "disarm-after-trigger" }]},
                                                                      { name: "disarm-after-trigger",
                                                                        sources: [{ property: "target-state", value: "disarmed", nextState: "disarm-immediate" }],
                                                                        actions: [{ property: "target-state", value: "disarmed" }]} ] }, _config);

   this.ensurePropertyExists('alarm-state', 'combinestateproperty', { name: "alarm-state", type: "combinestateproperty", ignoreControl: true,
                                                                      takeControlOnTransition: true, separator: "-",
                                                                      sources: [{ property: "arm-type-state" }, { property: "arm-state" }] }, _config);

}

util.inherits(HouseAlarm, Thing);

// Called when system state is required
HouseAlarm.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
   _exportObj.transactionTarget = this.transactionTarget;
   _exportObj.pollsMissed = this.pollsMissed;
   _exportObj.acknowledgementTimer = this.acknowledgementTimer ? this.acknowledgementTimer.expiration() : -1;
   _exportObj.watchdog = this.watchdog ? this.watchdog.expiration() : -1;
};

// Called when current state required
HouseAlarm.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
   this.transactionTarget = _importObj.transactionTarget;
   this.pollsMissed = _importObj.pollsMissed;
   this.acknowledgementTimer = (_importObj.acknowledgementTimer === -1) ? null : _importObj.acknowledgementTimer;
   this.watchdog = (_importObj.watchdog === -1) ? null : _importObj.watchdog;
};

HouseAlarm.prototype.coldStart = function() {

   this.server = net.createServer( (_socket) => {
      this.newConnection(_socket);
   });

   this.server.listen(this.serverPort);
   Thing.prototype.coldStart.call(this); 
};

HouseAlarm.prototype.hotStart = function() {
   this.setAcknowledgementTimer(this.acknowledgementTimer);
   this.restartWatchdog(this.watchdog);

   this.server = net.createServer( (_socket) => {
      this.newConnection(_socket);
   });

   Thing.prototype.hotStart.call(this);
};

HouseAlarm.prototype.newConnection = function(_socket) {
   console.log(this.uName + ": New connection from Texecom Alarm at address " + _socket.remoteAddress);

  _socket.on('data', (_data) => {

     if (_data.slice(0,3) == '+++') {
        return;
     }

     if (_data.slice(-2) != '\r\n') {
        console.log(this.uName + ": Ignoring line with missing terminator");
        return;
     }

     var newData = _data.slice(0,-2);

     if (newData.slice(0,4) == 'POLL') {
        this.handlePollEvent(_socket, newData);
     }
     else if (this.decoders[newData.slice(0,1)] != undefined) {
        var message = this.decoders[newData.slice(0,1)].decodeMessage(newData.slice(1));

        if (message != undefined) {
           this.handleMessage(_socket, message, newData);
        }
        else {
           console.log(this.uName + ": Unhandled Message");
        }
     }
     else {
        console.log(this.uName + ": Unhandled Message");
     }
  });

  _socket.on('error', (_error) => {
     console.error(this.uName + ": Socket error! Error = ", _error);
  });

  _socket.on('disconnect', (_error) => {
     console.log(this.uName + ": Socket disconnected.");
  });
};

HouseAlarm.prototype.handlePollEvent = function(_socket, _data) {
   // POLL flags (not all of these are verified - see docs)
   var FLAG_LINE_FAILURE = 1;
   var FLAG_AC_FAILURE = 2;
   var FLAG_BATTERY_FAILURE = 4;
   var FLAG_ARMED = 8;
   var FLAG_ENGINEER = 16;

   var parts = _data.toString().slice(4).trim().split('#');
   var account = parts[0];
   var flags = (parts[1][0]+'').charCodeAt(0);

   var buf = new Buffer('5b505d0000060d0a','hex');
   buf.writeInt16BE(this.pollingInterval / 1000 / 60,3)
   _socket.write(buf);

   if (this.pollsMissed > 0) {
      console.log(this.uName + ": Polling recovered (within tolerance) with Texecom alarm!");
      this.pollsMissed = 0;
   }

   if (!this.getProperty('ACTIVE')) {
      console.log(this.uName + ": Connection restored to Texecom alarm!");
      this.alignPropertyValue('ACTIVE', true);
   }

   if (((flags & FLAG_LINE_FAILURE) != 0) != this.getProperty('line-failure')) {
      this.alignPropertyValue('line-failure', ((flags & FLAG_LINE_FAILURE) != 0));
   }

   if (((flags & FLAG_AC_FAILURE) != 0) != this.getProperty('ac-power-failure')) {
      this.alignPropertyValue('ac-power-failure', ((flags & FLAG_AC_FAILURE) != 0));
   }

   if (((flags & FLAG_BATTERY_FAILURE) != 0) != this.getProperty('battery-failure')) {
      this.alignPropertyValue('battery-failure', ((flags & FLAG_BATTERY_FAILURE) != 0));
   }

   if (((flags & FLAG_ARMED) != 0) != this.getProperty('armed-normal')) {
      this.alignPropertyValue('armed-normal', ((flags & FLAG_ARMED) != 0));
   }

   if (((flags & FLAG_ENGINEER) != 0) != this.getProperty('engineer-mode')) {
      this.alignPropertyValue('engineer-mode', ((flags & FLAG_ENGINEER) != 0));
   }

   console.log(this.uName + ": Poll received from alarm. Flags="+flags);
   this.restartWatchdog();
};

HouseAlarm.prototype.handleMessage = function(_socket, _message, _data) {

   // Send ACK
   buf = new Buffer('00060d0a', 'hex');
   buf[0] = _data[0];
   _socket.write(buf);

   if (this.eventHandlers.hasOwnProperty(_message.event)) {
      this.eventHandlers[_message.event].call(this, _message);
   }
   else if (_message.property != undefined) {
      this.alignPropertyValue(_message.property, _message.propertyValue); 
      console.log(this.uName+": Message received, event="+_message.event+" - "+ _message.description, + ", value=" + _message.value);
      this.alignPropertyValue('alarm-error', "ARC event="+_message.event+", "+_message.property+"="+_message.propertyValue);
   }
   else {
      console.log(this.uName+": message received that had no property: \""+_message.description+"\"");
      this.alignPropertyValue('alarm-error', "ARC event not handled. Event="+_message.event+", qual="+_message.qualifier);
   }

   setTimeout( () => {
      _socket.destroy();
   }, 1000);
};

HouseAlarm.prototype.restartWatchdog = function(_overrideTimeout) {
   var timeout, f;

   if (_overrideTimeout) {
      f = util.restoreTimeout;
      timeout = _overrideTimeout;
   }
   else {

      if (this.watchdog) {
         util.clearTimeout(this.watchdog);
         this.pollsMissed = 0;
      }

      f = util.setTimeout;
      timeout = this.pollingTimeout;
   }

   this.watchdog = f( () => {
      this.watchdog = null;
      this.pollsMissed++;

      if (this.pollsMissed > this.maxPollMisses) {
         // Lost connection with alarm
         console.error(this.uName + ": Lost connection to Texecom Alarm!");
         this.pollsMissed = 0;
         this.alignPropertyValue('ACTIVE', false);
      }
      else {
         this.restartWatchdog();
      }

   }, timeout, 500);
};

HouseAlarm.prototype.stopWatchdog = function() {

   if (this.watchdog) {
      util.clearTimeout(this.watchdog);
      this.watchdog = null;
   }
};

HouseAlarm.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_propName == "target-state") {

      if (_propValue != this.getProperty('current-state')) {

         if ((_propValue !== STATE_DISARMED) && (this.getProperty('current-state') !== STATE_DISARMED)) {
            // Don't allow this state transition AWAY<->HOME<->NIGHT<->AWAY, must go via DISARMED state - just move to disarmed state
            this.alignPropertyValue("target-state", this.getProperty('current-state'));
         }
         else {
            setTimeout( () => {     // Make sure the target-state is set before executing request
                this.initiateNewTransaction(_propValue);
            }, 10);
         }
      }
   }
   else if (_propName == "zone-alarm") {
      this.alignPropertyValue("current-state", (_propValue) ? STATE_ALARM_TRIGGERED : STATE_DISARMED);
   }
};

HouseAlarm.prototype.setAcknowledgementTimer = function(_overrideTimeout) {

   if (_overrideTimeout) {

      this.acknowledgementTimer = util.retoreTimeout( () => {
         console.error(this.uName + ": Alarm has not acknowledged order to arm, failing transaction");
         this.alignPropertyValue("target-state", this.getProperty("current-state"));
      }, _overrideTimeout, 500);
   }
   else {

      this.acknowledgementTimer = util.setTimeout( () => {
         console.error(this.uName + ": Alarm has not acknowledged order to arm, failing transaction");
         this.alignPropertyValue("target-state", this.getProperty("current-state"));
      }, 60000);
   }
   
};

HouseAlarm.prototype.clearAcknowledgementTimer = function() {

   if (this.acknowledgementTimer) {
      util.clearTimeout(this.acknowledgementTimer);
      this.acknowledgementTimer = null;
   }
};

HouseAlarm.prototype.initiateNewTransaction = function(_transactionTarget) {
   this.clearAcknowledgementTimer();

   if (this.getProperty('alarm-connection-state') !== "idle-state") {
      console.log(this.uName + ": Request for new transaction received while servicing another transaction, queue it up!");
      this.transactionTarget = _transactionTarget;
      return;
   }

   if (this.transactionTarget === _transactionTarget) {
      console.log(this.uName+": States already in sync, job done!");
      return;
   }

   this.transactionTarget = _transactionTarget;

   console.log(this.uName+": Attempting to move states from current state:"+this.getProperty('current-state') +
               " to target state:"+this.transactionTarget);

   this.raiseEvent('connect-to-alarm');
};

HouseAlarm.prototype.sendToAlarmAppendChecksum = function(_buffer) {
   var sum = 0;

   for (var i = 0; i < _buffer.length-1; ++i) {
      sum += _buffer[i];
   }
   console.log(this.uName + ": Sum of bytes = " + sum);

   _buffer[_buffer.length-1] = (sum & 0xff) ^ 0xff;
  this.sendToAlarm(_buffer);
};

HouseAlarm.prototype.sendToAlarm = function(_buffer) {
   console.log(this.uName + ": Buffer sent to alarm: ", _buffer);
   this.socket.write(_buffer);
};

HouseAlarm.prototype.processAlarmStatus = function(_buffer) {

   if (this.getProperty('armed-normal')) {
      var partArmed = false;

      for (var i = 0; i <= 3; ++i) {
         this.alarmStateMap[i].value = _buffer[this.alarmStateMap[i].nineDIndex] == 1;

         if (this.alarmStateMap[i].prop && (this.alarmStateMap[i].prop.value != this.alarmStateMap[i].value)) {

            if (i > 0) {
               partArmed |= this.alarmStateMap[i].value;
            }
            this.alignPropertyValue(this.alarmStateMap[i].prop.name, this.alarmStateMap[i].value);

            if (this.alarmStateMap[i].value) {
               this.alignPropertyValue("target-state", this.alarmStateMap[i].state);
               this.alignPropertyValue("current-state", this.alarmStateMap[i].state);
            }
         }
      }

      if (partArmed && !this.getProperty('part-armed')) {
         this.alignPropertyValue('part-armed', true);
      }
   }
};

HouseAlarm.prototype.alarmArmNormalHandler = function(_message) {
   this.alignPropertyValue(_message.property, _message.propertyValue);

   if (_message.propertyValue) {

      setTimeout( () => {
         this.initiateNewTransaction(REQUEST_STATE);
      }, 3000);
   }
   else {
      this.alignPropertyValue("zone-alarm", false);
      this.alignPropertyValue("confirmed-alarm", false);

      if (this.getProperty("part-armed")) {
         this.alignPropertyValue("night-armed", false);
         this.alignPropertyValue("stay-armed", false);
         this.alignPropertyValue("part-armed", false);
      }
      else if (this.getProperty("away-armed")) {
         this.alignPropertyValue("away-armed", false);
      }

      this.alignPropertyValue("current-state", STATE_DISARMED);
      this.alignPropertyValue("target-state", STATE_DISARMED);
   }
}

HouseAlarm.prototype.alarmDownloadHandler = function(_message) {
   // DO NOTHING
};

HouseAlarm.prototype.alarmAbortHandler = function(_message) {

   if (this.getProperty("part-armed")) {
      this.alignPropertyValue("night-armed", false);
      this.alignPropertyValue("stay-armed", false);
      this.alignPropertyValue("part-armed", false);
   }
   else if (this.getProperty("away-armed")) {
      this.alignPropertyValue("away-armed", false);
   }
  
   if (this.getProperty("armed-normal")) {
      this.alignPropertyValue("armed-normal", false);
   }
};

HouseAlarm.prototype.exitErrorHandler = function(_message) {
};

// Connection State Property Handlers
HouseAlarm.prototype.handleIdleState = function(_currentState) {
};

HouseAlarm.prototype.connectToAlarm = function(_currentState) {
   console.log(this.uName + ': Connecting to Texecom alarm');
   console.log(this.uName + ': Connecting to ip='+this.alarmAddress+' port='+this.alarmPort);

   if (!this.socket || this.socket.destroyed) {
      this.socket = net.createConnection({ port: this.alarmPort, host: this.alarmAddress });

      this.socket.on('connect', (_buffer) => {
         console.log(this.uName + ': Connected to alarm');
         this.raiseEvent('connected');
      });

      this.socket.on('error', (_error) => {
         console.error(this.uName + ": Error connecting to Texecom alarm, error:"+_error);
         this.raiseEvent('error', { value: _error });
      });

      this.socket.on('data', (_buffer) => {
         console.log(this.uName + ": Received data from Texecom alarm in state " + this.getProperty('alarm-connection-state') + " = ", _buffer);
         this.receiveBuffer = _buffer;
         this.raiseEvent('data-received-from-alarm');
      });

      this.socket.on('end', (_buffer) => {
         console.log(this.uName + ": Socket to alarm closed.");
         this.raiseEvent('socket-closed');
      });
   }
   else {
      this.socket.connect({ port: this.alarmPort, host: this.alarmAddress });
   }
};

HouseAlarm.prototype.wakeUpPanel = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x03, 0x5a, 0x00], 'ascii'));
};

HouseAlarm.prototype.handleWakeUpResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x0b, 0x5a, 0x05, 0x01, 0x00, 0x00, 0x01, 0x06, 0x04, 0x08, 0x81], 'ascii'))) {
      this.raiseEvent("log-in-to-panel");
   }
   else {
      console.error(this.uName + ": Failed to wake up panel!");
      this.raiseEvent('error', { value: 'Failed to wake panel up!' });
   }
};

HouseAlarm.prototype.logInToPanel = function(_currentState) {
   var buffer = Buffer.from("  " + this.udl + " ", 'ascii');
   buffer[0] = 0x09;
   buffer[1] = 0x5a;
   this.sendToAlarmAppendChecksum(buffer);
};

HouseAlarm.prototype.sendCommandToAlarm = function() {

   switch (this.transactionTarget) {
    case STATE_STAY_ARM:
    case STATE_NIGHT_ARM:
    case STATE_AWAY_ARM:
      this.raiseEvent('arm-alarm');
      break;
    case STATE_DISARMED:
      this.raiseEvent('disarm-alarm');
      break;
    case REQUEST_STATE:
      this.raiseEvent('retrieve-info-from-alarm');
      break;
   }
};

HouseAlarm.prototype.handleLoginResponse = function(_currentState, _data) {

   if (!this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.uName + ": Logged in to panel successfully");
      this.sendCommandToAlarm();
   }
   else {
      console.error(this.uName + ": Unable to log into Texecom alarm user - Check UDL");
      this.raiseEvent('error', { value: 'Failed to log into panel - Check UDL!' });
   }
};

HouseAlarm.prototype.armAlarm = function(_currentState) {

   switch (this.transactionTarget) {
    case STATE_STAY_ARM:
      this.sendToAlarmAppendChecksum(Buffer.from([0x05, 0x53, 0x00, this.stayPartArmNumber, 0x00], 'ascii'));
      break;
    case STATE_NIGHT_ARM:
      this.sendToAlarmAppendChecksum(Buffer.from([0x05, 0x53, 0x00, this.nightPartArmNumber, 0x00], 'ascii'));
      break;
    case STATE_AWAY_ARM:
      this.sendToAlarmAppendChecksum(Buffer.from([0x04, 0x41, 0x00, 0x00], 'ascii'));
      break;
   }
};

HouseAlarm.prototype.handleArmResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.uName + ": Arm command acknowledged by Texecom alarm");
      this.setAcknowledgementTimer();
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.uName + ": Unable to arm alarm!");
      this.raiseEvent('error', { value: "Unable to arm alarm!" });
   }
};

HouseAlarm.prototype.disarmAlarm = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x04, 0x44, 0x00, 0x00], 'ascii'));
};

HouseAlarm.prototype.handleDisarmResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.uName + ": Disarming command acknowledged by Texecom alarm");
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.uName + ": Unable to Disarm alarm!");
      this.raiseEvent('error', { value: "Unable to Disarm alarm!" });
   }
};

HouseAlarm.prototype.retrieveInfoFromAlarm = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x07, 0x52, 0x00, 0x17, 0xb2, 0x40, 0x00], 'ascii'));
};

HouseAlarm.prototype.handleRetrieveInfoResponse = function(_currentState, _data) {

   if ((this.receiveBuffer.slice(0,7).equals(Buffer.from([0x47,0x57,0x0,0x17,0xb2,0x40,0xf], 'ascii'))) && (this.receiveBuffer.length >= 71)) {
      console.log(this.uName + ":  Received status from alarm");
      this.processAlarmStatus(this.receiveBuffer);
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.uName + ": Unable to retrieve info from alarm!");
      this.raiseEvent('error', { value: "Unable to retrieve info from alarm!" });
   }
};

HouseAlarm.prototype.transactionComplete = function(_currentState) {
   var targetState = (this.transactionTarget === REQUEST_STATE) ? this.getProperty('current-state') : this.transactionTarget;

   if (targetState === this.getProperty('target-state')) {
      this.socket.destroy();
      this.socket = null;
      this.transactionTarget = REQUEST_STATE_IDLE;
      this.raiseEvent('go-idle');
   }
   else {
      this.transactionTarget = this.getProperty('target-state');
      this.sendCommandToAlarm();
   }
};

HouseAlarm.prototype.errorHasOccurred = function(_currentState) {

   if (this.socket) {
      this.socket.destroy();
      this.socket = null;
   }

   this.alignPropertyValue('target-state', this.getProperty('current-state'));
   this.transactionTarget = REQUEST_STATE_IDLE;
   this.raiseEvent('go-idle');
};

module.exports = exports = HouseAlarm;
