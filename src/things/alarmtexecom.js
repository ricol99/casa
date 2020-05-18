//
// Texecom Alarm Receiving Server
// Converted from 
// Mike Stirling Python version
// Copyright 2016 Mike Stirling and Richard Collin

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
 
//     http://www.apache.org/licenses/LICENSE-2.0
 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
 
var util = require('util');
var Thing = require('../thing');
var net = require('net');
var ContactIdProtocol = require('./contactidprotocol');
var SIAProtocol = require('./siaprotocol');

var STATE_STAY_ARM = 0;
var STATE_AWAY_ARM = 1;
var STATE_NIGHT_ARM = 2;
var STATE_DISARMED = 3;
var STATE_ALARM_TRIGGERED = 4;

var REQUEST_STATE_IDLE = 999;
var REQUEST_STATE = 100;

function AlarmTexecom(_config, _parent) {

   Thing.call(this, _config, _parent);

   this.pollingInterval = _config.pollingInterval * 1000 * 60;   // mins into ms
   this.maxPollMisses = (_config.maxPollMisses == undefined) ? 3 : _config.maxPollMisses;

   // Secure config
   this.alarmAddress = _config.alarmAddress;
   this.serverPort = _config.serverPort;
   this.alarmPort = _config.alarmPort;
   this.udl = _config.udl;
   this.userNumber = _config.userNumber;
   this.stayPartArmNumber = _config.hasOwnProperty("stayPartArmNumber") ? _config.stayPartArmNumber : 1;
   this.nightPartArmNumber = _config.hasOwnProperty("nightPartArmNumber") ? _config.nightPartArmNumber : 2;

   this.transactionTarget = REQUEST_STATE_IDLE;

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('current-state', 'property', { initialValue: STATE_DISARMED }, _config);
   this.ensurePropertyExists('target-state', 'property', { initialValue: STATE_DISARMED }, _config);

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

   this.alarmStateMap = [ { nineDIndex: 68, prop: this.props['away-armed'], state: STATE_AWAY_ARM, value: false },
                          { nineDIndex: 42, value: false }, { nineDIndex: 44, value: false },
                          { nineDIndex: 46, value: false } ];

   this.alarmStateMap[this.stayPartArmNumber].prop = this.props['stay-armed'];
   this.alarmStateMap[this.stayPartArmNumber].state = STATE_STAY_ARM;
   this.alarmStateMap[this.nightPartArmNumber].prop = this.props['night-armed'];
   this.alarmStateMap[this.nightPartArmNumber].state = STATE_NIGHT_ARM;

   this.pollingTolerance = 30000;   // ms
   this.pollingTimeout = this.pollingInterval + this.pollingTolerance;
   this.pollsMissed = 0;

   this.decoders = { 2: new ContactIdProtocol(this.fullName+":contactid:"+this.gang.casa.name), 3: new SIAProtocol(this.fullName+":sia:"+this.gang.casa.name) };

   this.eventHandlers = {};
   this.eventHandlers["401"] = AlarmTexecom.prototype.alarmArmNormalHandler;
   this.eventHandlers["402"] = AlarmTexecom.prototype.alarmArmNormalHandler;
   this.eventHandlers["403"] = AlarmTexecom.prototype.alarmArmNormalHandler;
   this.eventHandlers["407"] = AlarmTexecom.prototype.alarmArmNormalHandler;
   this.eventHandlers["408"] = AlarmTexecom.prototype.alarmArmNormalHandler;

   this.eventHandlers["411"] = AlarmTexecom.prototype.alarmDownloadHandler;
   this.eventHandlers["412"] = AlarmTexecom.prototype.alarmDownloadHandler;

   this.eventHandlers["406"] = AlarmTexecom.prototype.alarmAbortHandler;
   this.eventHandlers["457"] = AlarmTexecom.prototype.exitErrorHandler;

   this.ensurePropertyExists('alarm-connection-state', 'stateproperty', {
       initialValue: "idle-state",
       ignoreControl: true,
       states: [
          {
             name: "idle-state",
             action: { handler: "handleIdleState" },
             source: { event: "connect-to-alarm", nextState: "connect-to-alarm-state" }
          },
          {
             name: "connect-to-alarm-state",
             action: { handler: "connectToAlarm" },
             timeout: { duration: 10, nextState: "error-state" },
             sources: [{ event: "connected", nextState: "wake-up-panel-state" },
                       { event: "error", nextState: "error-state"}]
          },
          {
             name: "wake-up-panel-state",
             action: { delay: 1.5, handler: "wakeUpPanel" },
             timeout: { duration: 6.5, nextState: "error-state" },
             sources: [{ event: "data-received-from-alarm", handler: "handleWakeUpResponse" },
                       { event: "log-in-to-panel", nextState: "log-in-to-panel-state" },
                       { event: "error", nextState: "error-state"},
                       { event: "socket-closed", nextState: "error-state"}]
          },
          {
             name: "log-in-to-panel-state",
             action: { handler: "logInToPanel" },
             timeout: { duration: 5, nextState: "error-state" },
             sources: [{ event: "data-received-from-alarm", handler: "handleLoginResponse" },
                       { event: "socket-closed", nextState: "error-state"},
                       { event: "error", nextState: "error-state"},
                       { event: "arm-alarm", nextState: "arm-alarm-state" },
                       { event: "disarm-alarm", nextState: "disarm-alarm-state" },
                       { event: "retrieve-info-from-alarm", nextState: "retrieve-info-from-alarm-state" }]
          },
          {
             name: "arm-alarm-state",
             action: { handler: "armAlarm" },
             timeout: { duration: 5, nextState: "error-state" },
             sources: [{ event: "data-received-from-alarm", handler: "handleArmResponse" },
                       { event: "alarm-transaction-complete", nextState: "transaction-complete-state" },
                       { event: "error", nextState: "error-state"}]
          },
          {
             name: "disarm-alarm-state",
             action: { handler: "disarmAlarm" },
             timeout: { duration: 5, nextState: "error-state" },
             sources: [{ event: "data-received-from-alarm", handler: "handleDisarmResponse" },
                       { event: "alarm-transaction-complete", nextState: "transaction-complete-state" },
                       { event: "error", nextState: "error-state"}]
          },
          {
             name: "retrieve-info-from-alarm-state",
             action: { handler: "retrieveInfoFromAlarm" },
             timeout: { duration: 5, nextState: "error-state" },
             sources: [{ event: "data-received-from-alarm", handler: "handleRetrieveInfoResponse" },
                       { event: "alarm-transaction-complete", nextState: "transaction-complete-state" },
                       { event: "error", nextState: "error-state"}]
          },
          {
             name: "transaction-complete-state",
             action: { handler: "transactionComplete" },
             sources: [{ event: "socket-closed", nextState: "idle-state"},
                       { event: "go-idle", nextState: "idle-state" },
                       { event: "arm-alarm", nextState: "arm-alarm-state" },
                       { event: "disarm-alarm", nextState: "disarm-alarm-state" },
                       { event: "retrieve-info-from-alarm", nextState: "retrieve-info-from-alarm-state" }]
          },
          {
             name: "error-state",
             action: { handler: "errorHasOccurred" },
             sources: [{ event: "go-idle", nextState: "idle-state" }]
          }
      ]
   }, _config);
}

util.inherits(AlarmTexecom, Thing);

AlarmTexecom.prototype.newConnection = function(_socket) {
   console.log(this.fullName + ": New connection from Texecom Alarm at address " + _socket.remoteAddress);

  _socket.on('data', (_data) => {

     if (_data.slice(0,3) == '+++') {
        return;
     }

     if (_data.slice(-2) != '\r\n') {
        console.log(this.fullName + ": Ignoring line with missing terminator");
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
           console.log(this.fullName + ": Unhandled Message");
        }
     }
     else {
        console.log(this.fullName + ": Unhandled Message");
     }
  });

  _socket.on('error', (_error) => {
     console.error(this.fullName + ": Socket error! Error = ", _error);
  });

  _socket.on('disconnect', (_error) => {
     console.log(this.fullName + ": Socket disconnected.");
  });
};


AlarmTexecom.prototype.coldStart = function() {

   this.server = net.createServer( (_socket) => {

      //if ((this.alarmAddress && _socket.remoteAddress === this.alarmAddress) || (!this.alarmAddress)) {
         this.newConnection(_socket);
      //}
      //else {
         //_socket.destroy();
      //}
   });

   this.server.listen(this.serverPort);
   Thing.prototype.coldStart.call(this); 
};

AlarmTexecom.prototype.handlePollEvent = function(_socket, _data) {
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
      console.log(this.fullName + ": Polling recovered (within tolerance) with Texecom alarm!");
      this.pollsMissed = 0;
   }

   if (!this.getProperty('ACTIVE')) {
      console.log(this.fullName + ": Connection restored to Texecom alarm!");
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

   console.log(this.fullName + ": Poll received from alarm. Flags="+flags);
   this.restartWatchdog();
};

AlarmTexecom.prototype.handleMessage = function(_socket, _message, _data) {

   // Send ACK
   buf = new Buffer('00060d0a', 'hex');
   buf[0] = _data[0];
   _socket.write(buf);

   if (this.eventHandlers.hasOwnProperty(_message.event)) {
      this.eventHandlers[_message.event].call(this, _message);
   }
   else if (_message.property != undefined) {
      this.alignPropertyValue(_message.property, _message.propertyValue); 
      console.log(this.fullName+": Message received, event="+_message.event+" - "+ _message.description, + ", value=" + _message.value);
      this.alignPropertyValue('alarm-error', "ARC event="+_message.event+", "+_message.property+"="+_message.propertyValue);
   }
   else {
      console.log(this.fullName+": message received that had no property: \""+_message.description+"\"");
      this.alignPropertyValue('alarm-error', "ARC event not handled. Event="+_message.event+", qual="+_message.qualifier);
   }

   setTimeout( () => {
      _socket.destroy();
   }, 1000);
};

AlarmTexecom.prototype.restartWatchdog = function() {

   if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.pollsMissed = 0;
   }

   this.watchdog = setTimeout( () => {
      this.watchdog = null;
      this.pollsMissed++;

      if (this.pollsMissed > this.maxPollMisses) {
         // Lost connection with alarm
         console.error(this.fullName + ": Lost connection to Texecom Alarm!");
         this.pollsMissed = 0;
         this.alignPropertyValue('ACTIVE', false);
      }
      else {
         this.restartWatchdog();
      }

   }, this.pollingTimeout);
};

AlarmTexecom.prototype.stopWatchdog = function() {

   if (this.watchdog) {
      this.clearTimeout(this.watchdog);
      this.watchdog = null;
   }
};

AlarmTexecom.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

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

AlarmTexecom.prototype.setAcknowledgementTimer = function() {

   this.acknowledgementTimer = setTimeout( () => {
      console.error(this.fullName + ": Alarm has not acknowledged order to arm, failing transaction");
      this.alignPropertyValue("target-state", this.getProperty("current-state"));
   }, 60000);
};

AlarmTexecom.prototype.clearAcknowledgementTimer = function() {

   if (this.acknowledgementTimer) {
      clearTimeout(this.acknowledgementTimer);
      this.acknowledgementTimer = null;
   }
};

AlarmTexecom.prototype.initiateNewTransaction = function(_transactionTarget) {
   this.clearAcknowledgementTimer();

   if (this.getProperty('alarm-connection-state') !== "idle-state") {
      console.log(this.fullName + ": Request for new transaction received while servicing another transaction, queue it up!");
      this.transactionTarget = _transactionTarget;
      return;
   }

   if (this.transactionTarget === _transactionTarget) {
      console.log(this.fullName+": States already in sync, job done!");
      return;
   }

   this.transactionTarget = _transactionTarget;

   console.log(this.fullName+": Attempting to move states from current state:"+this.getProperty('current-state') +
               " to target state:"+this.transactionTarget);

   this.raiseEvent('connect-to-alarm');
};

AlarmTexecom.prototype.sendToAlarmAppendChecksum = function(_buffer) {
   var sum = 0;

   for (var i = 0; i < _buffer.length-1; ++i) {
      sum += _buffer[i];
   }
   console.log(this.fullName + ": Sum of bytes = " + sum);

   _buffer[_buffer.length-1] = (sum & 0xff) ^ 0xff;
  this.sendToAlarm(_buffer);
};

AlarmTexecom.prototype.sendToAlarm = function(_buffer) {
   console.log(this.fullName + ": Buffer sent to alarm: ", _buffer);
   this.socket.write(_buffer);
};

AlarmTexecom.prototype.processAlarmStatus = function(_buffer) {

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

AlarmTexecom.prototype.alarmArmNormalHandler = function(_message) {
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

AlarmTexecom.prototype.alarmDownloadHandler = function(_message) {
   // DO NOTHING
};

AlarmTexecom.prototype.alarmAbortHandler = function(_message) {

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

AlarmTexecom.prototype.exitErrorHandler = function(_message) {
};

// Connection State Property Handlers
AlarmTexecom.prototype.handleIdleState = function(_currentState) {
};

AlarmTexecom.prototype.connectToAlarm = function(_currentState) {
   console.log(this.fullName + ': Connecting to Texecom alarm');
   console.log(this.fullName + ': Connecting to ip='+this.alarmAddress+' port='+this.alarmPort);

   if (!this.socket || this.socket.destroyed) {
      this.socket = net.createConnection({ port: this.alarmPort, host: this.alarmAddress });

      this.socket.on('connect', (_buffer) => {
         console.log(this.fullName + ': Connected to alarm');
         this.raiseEvent('connected');
      });

      this.socket.on('error', (_error) => {
         console.error(this.fullName + ": Error connecting to Texecom alarm, error:"+_error);
         this.raiseEvent('error', { value: _error });
      });

      this.socket.on('data', (_buffer) => {
         console.log(this.fullName + ": Received data from Texecom alarm in state " + this.getProperty('alarm-connection-state') + " = ", _buffer);
         this.receiveBuffer = _buffer;
         this.raiseEvent('data-received-from-alarm');
      });

      this.socket.on('end', (_buffer) => {
         console.log(this.fullName + ": Socket to alarm closed.");
         this.raiseEvent('socket-closed');
      });
   }
   else {
      this.socket.connect({ port: this.alarmPort, host: this.alarmAddress });
   }
};

AlarmTexecom.prototype.wakeUpPanel = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x03, 0x5a, 0x00], 'ascii'));
};

AlarmTexecom.prototype.handleWakeUpResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x0b, 0x5a, 0x05, 0x01, 0x00, 0x00, 0x01, 0x06, 0x04, 0x08, 0x81], 'ascii'))) {
      this.raiseEvent("log-in-to-panel");
   }
   else {
      console.error(this.fullName + ": Failed to wake up panel!");
      this.raiseEvent('error', { value: 'Failed to wake panel up!' });
   }
};

AlarmTexecom.prototype.logInToPanel = function(_currentState) {
   var buffer = Buffer.from("  " + this.udl + " ", 'ascii');
   buffer[0] = 0x09;
   buffer[1] = 0x5a;
   this.sendToAlarmAppendChecksum(buffer);
};

AlarmTexecom.prototype.sendCommandToAlarm = function() {

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

AlarmTexecom.prototype.handleLoginResponse = function(_currentState, _data) {

   if (!this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.fullName + ": Logged in to panel successfully");
      this.sendCommandToAlarm();
   }
   else {
      console.error(this.fullName + ": Unable to log into Texecom alarm user - Check UDL");
      this.raiseEvent('error', { value: 'Failed to log into panel - Check UDL!' });
   }
};

AlarmTexecom.prototype.armAlarm = function(_currentState) {

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

AlarmTexecom.prototype.handleArmResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.fullName + ": Arm command acknowledged by Texecom alarm");
      this.setAcknowledgementTimer();
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.fullName + ": Unable to arm alarm!");
      this.raiseEvent('error', { value: "Unable to arm alarm!" });
   }
};

AlarmTexecom.prototype.disarmAlarm = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x04, 0x44, 0x00, 0x00], 'ascii'));
};

AlarmTexecom.prototype.handleDisarmResponse = function(_currentState, _data) {

   if (this.receiveBuffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
      console.log(this.fullName + ": Disarming command acknowledged by Texecom alarm");
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.fullName + ": Unable to Disarm alarm!");
      this.raiseEvent('error', { value: "Unable to Disarm alarm!" });
   }
};

AlarmTexecom.prototype.retrieveInfoFromAlarm = function(_currentState) {
   this.sendToAlarmAppendChecksum(Buffer.from([0x07, 0x52, 0x00, 0x17, 0xb2, 0x40, 0x00], 'ascii'));
};

AlarmTexecom.prototype.handleRetrieveInfoResponse = function(_currentState, _data) {

   if ((this.receiveBuffer.slice(0,7).equals(Buffer.from([0x47,0x57,0x0,0x17,0xb2,0x40,0xf], 'ascii'))) && (this.receiveBuffer.length >= 71)) {
      console.log(this.fullName + ":  Received status from alarm");
      this.processAlarmStatus(this.receiveBuffer);
      this.raiseEvent('alarm-transaction-complete');
   }
   else {
      console.error(this.fullName + ": Unable to retrieve info from alarm!");
      this.raiseEvent('error', { value: "Unable to retrieve info from alarm!" });
   }
};

AlarmTexecom.prototype.transactionComplete = function(_currentState) {
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

AlarmTexecom.prototype.errorHasOccurred = function(_currentState) {

   if (this.socket) {
      this.socket.destroy();
      this.socket = null;
   }

   this.alignPropertyValue('target-state', this.getProperty('current-state'));
   this.transactionTarget = REQUEST_STATE_IDLE;
   this.raiseEvent('go-idle');
};

module.exports = exports = AlarmTexecom;
