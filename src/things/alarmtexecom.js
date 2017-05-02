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

var REQUEST_STATE = 100;

function AlarmTexecom(_config) {

   Thing.call(this, _config);

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

   this.transactionTarget = STATE_DISARMED;
   this.transactionState = "idle";

   this.props['ACTIVE'].value = false;

   this.ensurePropertyExists('current-state', 'property', { initialValue: STATE_DISARMED });
   this.ensurePropertyExists('target-state', 'property', { initialValue: STATE_DISARMED });

   this.ensurePropertyExists('line-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('ac-power-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('battery-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('medical-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('panic-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('duress-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('attack-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('carbon-monoxide-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('tamper-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('armed-normal', 'property', { initialValue: false });
   this.ensurePropertyExists('part-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('stay-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('night-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('away-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false });
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false });
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' });

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

   this.decoders = { 2: new ContactIdProtocol("contactid:"+this.uName), 3: new SIAProtocol("sia:"+this.uName) };

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
}

util.inherits(AlarmTexecom, Thing);

AlarmTexecom.prototype.newConnection = function(_socket) {
   var that = this;
   console.log(this.uName + ": New connection from Texecom Alarm at address " + _socket.remoteAddress);

  _socket.on('data', function (_data) {

     if (_data.slice(0,3) == '+++') {
        return;
     }

     if (_data.slice(-2) != '\r\n') {
        console.log(that.uName + ": Ignoring line with missing terminator");
        return;
     }
     var newData = _data.slice(0,-2);

     if (newData.slice(0,4) == 'POLL') {
        that.handlePollEvent(_socket, newData);
     }
     else if (that.decoders[newData.slice(0,1)] != undefined) {
        var message = that.decoders[newData.slice(0,1)].decodeMessage(newData.slice(1));

        if (message != undefined) {
           that.handleMessage(_socket, message, newData);
        }
        else {
           console.log(that.uName + ": Unhandled Message");
        }
     }
     else {
        console.log(that.uName + ": Unhandled Message");
     }
  });
};


AlarmTexecom.prototype.coldStart = function(_event) {
   var that = this;

   this.server = net.createServer(function(_socket) {

      //if ((that.alarmAddress && _socket.remoteAddress === that.alarmAddress) || (!that.alarmAddress)) {
         that.newConnection(_socket);
      //}
      //else {
         //_socket.destroy();
      //}
   });

   this.server.listen(this.serverPort);
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
      console.log(this.uName + ": Polling recovered (within tolerance) with Texecom alarm!");
      this.pollsMissed = 0;
   }

   if (!this.props['ACTIVE'].value) {
      console.log(this.uName + ": Connection restored to Texecom alarm!");
      this.updateProperty('ACTIVE', true);
   }

   if (((flags & FLAG_LINE_FAILURE) != 0) != this.props['line-failure'].value) {
      this.updateProperty('line-failure', ((flags & FLAG_LINE_FAILURE) != 0));
   }

   if (((flags & FLAG_AC_FAILURE) != 0) != this.props['ac-power-failure'].value) {
      this.updateProperty('ac-power-failure', ((flags & FLAG_AC_FAILURE) != 0));
   }

   if (((flags & FLAG_BATTERY_FAILURE) != 0) != this.props['battery-failure'].value) {
      this.updateProperty('battery-failure', ((flags & FLAG_BATTERY_FAILURE) != 0));
   }

   if (((flags & FLAG_ARMED) != 0) != this.props['armed-normal'].value) {
      this.updateProperty('armed-normal', ((flags & FLAG_ARMED) != 0));
   }

   if (((flags & FLAG_ENGINEER) != 0) != this.props['engineer-mode'].value) {
      this.updateProperty('engineer-mode', ((flags & FLAG_ENGINEER) != 0));
   }

   console.log(this.uName + ": Poll received from alarm. Flags="+flags);
   this.restartWatchdog();
};

AlarmTexecom.prototype.handleMessage = function(_socket, _message, _data) {

   // Send ACK
   buf = new Buffer('00060d0a', 'hex');
   buf[0] = _data[0];
   _socket.write(buf);

   var info = {
      protocol: _message.protocol,
      accountNumber: _message.accountNumber,
      area: _message.area,
      event: _message.event,
      value: _message.value,
      valueType: _message.valueName,
      extraText: _message.extraText,
      description: _message.description
   };

   if (this.eventHandlers.hasOwnProperty(_message.event)) {
      this.eventHandlers[_message.event].call(this, _message);
   }
   else if (_message.property != undefined) {
      this.updateProperty(_message.property, _message.propertyValue); 
      console.log(this.uName+": Message received, event="+_message.event+" - "+ _message.description, + ", value=" + _message.value);
      this.updateProperty('alarm-error', "ARC event="+_message.event+", "+_message.property+"="+_message.propertyValue);
   }
   else {
      console.log(this.uName+": message received that had no property: \""+_message.description+"\"");
      this.updateProperty('alarm-error', "ARC event not handled. Event="+_message.event+", qual="+_message.qualifier);
   }

   setTimeout(function() {
      _socket.destroy();
   }, 1000);
};

AlarmTexecom.prototype.restartWatchdog = function() {

   if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.pollsMissed = 0;
   }

   this.watchdog = setTimeout(function(_this) {
      _this.watchdog = undefined;
      _this.pollsMissed++;

      if (_this.pollsMissed > _this.maxPollMisses) {
         // Lost connection with alarm
         console.info(_this.uName + ": Lost connection to Texecom Alarm!");
         _this.pollsMissed = 0;
         _this.updateProperty('ACTIVE', false);
      }
      else {
         _this.restartWatchdog();
      }

   }, this.pollingTimeout, this);
};

AlarmTexecom.prototype.stopWatchdog = function() {

   if (this.watchdog) {
      this.clearTimeout(this.watchdog);
      this.watchdog = undefined;
   }
};

AlarmTexecom.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_data.alignWithParent) {

      if (_propName == "target-state") {

         if (_propValue != this.props['current-state'].value) {

            if ((_propValue !== STATE_DISARMED) && (this.props['current-state'].value !== STATE_DISARMED)) {
               // Don't allow this state transition AWAY<->HOME<->NIGHT<->AWAY, must go via DISARMED state - just move to disarmed state
               this.setNextPropertyValue(_propName, STATE_DISARMED);
            }
            else {
               setTimeout(function(_this) {	// Make sure the target-state is set before executing request
                   _this.initiateNewTransaction(_propValue);
               }, 100, this);
            }
         }
         else if (this.transactionState != "idle") {

            setTimeout(function(_this) {	// Make sure the target-state is set before executing request
               _this.cancelOngoingRequest();
            }, 100, this);
         }
      }
   }

   if (_propName == "zone-alarm") {
      this.updateProperty("current-state", (_propValue) ? STATE_ALARM_TRIGGERED : STATE_DISARMED);
   }
};

AlarmTexecom.prototype.initiateNewTransaction = function(_transactionTarget, _forceState) {
   var that = this;

   if (!_forceState) {

      if (this.transactionState !== "idle") {
         console.log(this.uName+": Already requesting another action - cancelling it!");
         this.cancelOngoingRequest();
         return;
      }

      if (this.transactionTarget === _transactionTarget) {
         console.log(this.uName+": States already in sync, job done!");
         return;
      }
   }

   this.transactionTarget = _transactionTarget;

   console.log(this.uName+": Attempting to move states from current state:"+this.props['current-state'].value+
               " to target state:"+this.transactionTarget);

   this.transactionState = "connecting";
   console.log(this.uName + ': Connecting to Texecom alarm');
   console.log(this.uName + ': Connecting to ip='+this.alarmAddress+' port='+this.alarmPort);

   this.socket = net.createConnection({ port: this.alarmPort, host: this.alarmAddress });

   this.socket.on('connect', function(_buffer) {
      console.log(this.uName + ': Connected to alarm');
      that.transactionState = "connected";

      setTimeout(function(_this) {
         _this.sendNextMessage();
      }, 1500, that);
   });

   this.socket.on('error', function(_error) {
      console.log(that.uName + ': Error connecting to Texecom alarm, error:'+_error);
      that.failedToSendCommand();
   });

   this.socket.on('data', function(_buffer) {
      that.processResponse(_buffer);
   });

   this.socket.on('end', function(_buffer) {
      that.transactionState = "idle";
   });
};

AlarmTexecom.prototype.cancelOngoingRequest = function() {
   var buffer;

   switch (this.transactionState) {
      case "connecting":
      case "connected":
      case "panel-awake":
      case "logged-in-with-udl":
      case "waking-up-panel":
      case "logging-in-with-udl":
         clearTimeout(this.responseTimer);
         this.responseTimer = null;
         this.failedToSendCommand();
         this.initiateNewTransaction(this.props['target-state'].value);
         break;
      case "attempting-to-part-arm":
      case "attempting-to-night-arm":
      case "attempting-to-arm":
      case "attempting-to-disarm":
      case "attempting-to-retrieve-state":
	 // Do Nothing
         this.requestCancelled = true;
         break;
      case "part-arm-req-acked":
      case "away-arm-req-acked":
         this.initiateNewTransaction(STATE_DISARMED, true);
         break;
      default:
         console.log(this.uName + ": Not able to send data to alarm and not it the right state. Current state: "+this.transactionState);
   }
};

AlarmTexecom.prototype.sendNextMessage = function() {
   var buffer;

   switch (this.transactionState) {
      case "idle":
         break;
      case "connected":
         this.transactionState = "waking-up-panel";
         this.sendToAlarmAppendChecksum(Buffer.from([0x03, 0x5a, 0x00], 'ascii'));
         break;
      case "panel-awake":
         this.transactionState = "logging-in-with-udl";
         buffer = Buffer.from("  " + this.udl + " ", 'ascii');
         buffer[0] = 0x09;
         buffer[1] = 0x5a;
         this.sendToAlarmAppendChecksum(buffer);
         break;
      case "logged-in-with-udl":
         if (this.transactionTarget == STATE_STAY_ARM) {
            this.transactionState = "attempting-to-part-arm";
            this.sendToAlarmAppendChecksum(Buffer.from([0x05, 0x53, 0x00, this.stayPartArmNumber, 0x00], 'ascii'));
         }
         else if (this.transactionTarget == STATE_NIGHT_ARM) {
            this.transactionState = "attempting-to-night-arm";
            this.sendToAlarmAppendChecksum(Buffer.from([0x05, 0x53, 0x00, this.nightPartArmNumber, 0x00], 'ascii'));
         }
         else if (this.transactionTarget == STATE_AWAY_ARM) {
            this.transactionState = "attempting-to-arm";
            this.sendToAlarmAppendChecksum(Buffer.from([0x04, 0x41, 0x00, 0x00], 'ascii'));
         }
         else if (this.transactionTarget == STATE_DISARMED) {
            this.transactionState = "attempting-to-disarm";
            this.sendToAlarmAppendChecksum(Buffer.from([0x04, 0x44, 0x00, 0x00], 'ascii'));
         }
         else if (this.transactionTarget == REQUEST_STATE) {
            this.transactionState = "attempting-to-retrieve-state";
            this.sendToAlarmAppendChecksum(Buffer.from([0x07, 0x52, 0x00, 0x17, 0xb2, 0x40, 0x00], 'ascii'));
         }
         break;
      default:
         console.log(this.uName + ": Not able to send data to alarm and not it the right state. Current state: "+this.transactionState);
         this.failedToSendCommand();
   }
};

AlarmTexecom.prototype.sendToAlarmAppendChecksum = function(_buffer) {
   var sum = 0;

   for (var i = 0; i < _buffer.length-1; ++i) {
      sum += _buffer[i];
   }
   console.log(this.uName + ": Sum of bytes = " + sum);

   _buffer[_buffer.length-1] = (sum & 0xff) ^ 0xff;
  this.sendToAlarm(_buffer);
};

AlarmTexecom.prototype.sendToAlarm = function(_buffer) {

   this.responseTimer = setTimeout(function(_this) {
      _this.responseTimer = null;
      console.log(_this.uName + ": Response from alarm not received within timeout. Resetting");

      if (_this.requestCancelled) {
         _this.requestCancelled = false;
         _this.restartProcess(10000, "idle");
      }
      else {
         _this.failedToSendCommand();
      }
   }, 5000, this);

   console.log(this.uName + ": Buffer sent to alarm: ", _buffer);
   this.socket.write(_buffer);
};

AlarmTexecom.prototype.processResponse = function(_buffer) {

   if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
   }

   switch (this.transactionState) {
      case "waking-up-panel":
         if (_buffer.equals(Buffer.from([0x0b, 0x5a, 0x05, 0x01, 0x00, 0x00, 0x01, 0x06, 0x04, 0x08, 0x81], 'ascii'))) {
            this.transactionState = "panel-awake";
            console.log(this.uName + ": Logged into panel successfully");
            this.sendNextMessage();
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm panel - Check UDL");
            this.failedToSendCommand();
         }
         break;
      case "logging-in-with-udl":
         if (!_buffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
            this.transactionState = "logged-in-with-udl";
            console.log(this.uName + ": Logged in to panel successfully");
            this.sendNextMessage();
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm user - Check UDL");
            this.failedToSendCommand();
         }
         break;
      case "attempting-to-part-arm":
      case "attempting-to-night-arm":
      case "attempting-to-arm":
         if (_buffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
            this.transactionState = ((this.transactionTarget == STATE_STAY_ARM) || (this.transactionTarget == STATE_NIGHT_ARM)) ? "part-arm-req-acked" : "away-arm-req-acked";
            console.log(this.uName + ": Arming command acknowledged by Texecom alarm");

            if (this.requestCancelled) {
               this.requestCancelled = false;
               this.restartProcess(1000);
            }
            else {
               this.socket.destroy();
            }
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm panel - Check UDL");

            if (this.requestCancelled) {
               this.requestCancelled = false;
               this.restartProcess(2000, "idle");
            }
            else {
               this.failedToSendCommand();
            }
         }
         break;
      case "attempting-to-disarm":
         if (_buffer.equals(Buffer.from([0x03, 0x06, 0xf6], 'ascii'))) {
            console.log(this.uName + ": Disarming command acknowledged by Texecom alarm");
            this.requestCancelled = false;
            this.restartProcess(1000, "idle");
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm panel - Check UDL");

            if (this.requestCancelled) {
              this.requestCancelled = false;
              this.restartProcess(2000, "idle");
            }
            else {
               this.failedToSendCommand();
            }
         }
         break;
      case "attempting-to-retrieve-state":
         if ((_buffer.slice(0,7).equals(Buffer.from([0x47,0x57,0x0,0x17,0xb2,0x40,0xf], 'ascii'))) && (_buffer.length >= 71)) {
            console.log(this.uName + ":  Received status from alarm");
            this.requestCancelled = false;
            this.processAlarmStatus(_buffer);
            this.restartProcess(1000, "idle");
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm panel - Check UDL");

            if (this.requestCancelled) {
              this.requestCancelled = false;
              this.restartProcess(2000, "idle");
            }
            else {
               this.failedToSendCommand();
            }
         }
         break;
      default:
         console.log(this.uName + ": Not able to process data from alarm and not it the right state. Current state: "+this.transactionState);
         this.failedToSendCommand();
   }
};

AlarmTexecom.prototype.processAlarmStatus = function(_buffer) {

   this.transactionState = "idle";

   if (this.props['armed-normal'].value) {
      var partArmed = false;

      for (var i = 0; i <= 3; ++i) {
         this.alarmStateMap[i].value = _buffer[this.alarmStateMap[i].nineDIndex] == 1;

         if (this.alarmStateMap[i].prop && (this.alarmStateMap[i].prop.value != this.alarmStateMap[i].value)) {

            if (i > 0) {
               partArmed |= this.alarmStateMap[i].value;
            }
            this.updateProperty(this.alarmStateMap[i].prop.name, this.alarmStateMap[i].value);

            if (this.alarmStateMap[i].value) {
               this.updateProperty("target-state", this.alarmStateMap[i].state);
               this.updateProperty("current-state", this.alarmStateMap[i].state);
            }
         }
      }

      if (partArmed && !this.props['part-armed'].value) {
         this.updateProperty('part-armed', true);
      }
   }
};

AlarmTexecom.prototype.restartProcess = function(_timeout, _state) {
   this.socket.destroy();

   if (_state) {
      this.transactionState = _state;
   }

   setTimeout(function(_this) {
      _this.initiateNewTransaction(_this.props['target-state'].value);
   }, _timeout, this);
};

AlarmTexecom.prototype.failedToSendCommand = function() {

   if (this.transactionState !== "idle") {
      this.transactionState = "idle";
      this.socket.destroy();
      this.updateProperty('target-state', this.props['current-state'].value);
   }
};

AlarmTexecom.prototype.alarmArmNormalHandler = function(_message) {
   this.updateProperty(_message.property, _message.propertyValue);
   this.transactionState = "idle";

   if (_message.propertyValue) {

      setTimeout(function(_this) {     // Make sure the target-state is set before executing request
         _this.initiateNewTransaction(REQUEST_STATE);
      }, 3000, this);
   }
   else {
      this.updateProperty("zone-alarm", false);
      this.updateProperty("confirmed-alarm", false);

      if (this.props["part-armed"].value) {
         this.updateProperty("night-armed", false);
         this.updateProperty("stay-armed", false);
         this.updateProperty("part-armed", false);
      }
      else if (this.props["away-armed"].value) {
         this.updateProperty("away-armed", false);
      }

      this.updateProperty("current-state", STATE_DISARMED);
      this.updateProperty("target-state", STATE_DISARMED);
   }
}

AlarmTexecom.prototype.alarmDownloadHandler = function(_message) {
   // DO NOTHING
};

AlarmTexecom.prototype.alarmAbortHandler = function(_message) {

   if (this.props["part-armed"].value) {
      this.updateProperty("night-armed", false);
      this.updateProperty("stay-armed", false);
      this.updateProperty("part-armed", false);
   }
   else if (this.props["away-armed"].value) {
      this.updateProperty("away-armed", false);
   }
  
   if (this.props["armed-normal"].value) {
      this.updateProperty("armed-normal", false);
   }
};

AlarmTexecom.prototype.exitErrorHandler = function(_message) {

   if (this.armingMode != "idle") {
      this.updateProperty("target-state", STATE_DISARMED);
   }
};

module.exports = exports = AlarmTexecom;
