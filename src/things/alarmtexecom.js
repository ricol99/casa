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

   this.currentState = "disarmed";
   this.targetState = "disarmed";
   this.armingState = "idle";

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
   this.ensurePropertyExists('fully-armed', 'property', { initialValue: false });
   this.ensurePropertyExists('zone-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('confirmed-alarm', 'property', { initialValue: false });
   this.ensurePropertyExists('in-exit-entry', 'property', { initialValue: false });
   this.ensurePropertyExists('system-failure', 'property', { initialValue: false });
   this.ensurePropertyExists('engineer-mode', 'property', { initialValue: false });
   this.ensurePropertyExists('alarm-error', 'property', { initialValue: '' });

   this.pollingTolerance = 30000;   // ms
   this.pollingTimeout = this.pollingInterval + this.pollingTolerance;
   this.pollsMissed = 0;

   this.decoders = { 2: new ContactIdProtocol("contactid:"+this.uName), 3: new SIAProtocol("sia:"+this.uName) };

   this.eventHandlers = {};
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
        that.handleMessage(_socket, message, newData);
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

   if (_message.property != undefined) {
      this.updateProperty(_message.property, _message.propertyValue); 
      console.log(this.uName+": Message received, event="+_message.event+" - "+ _message.description);
      this.updateProperty('alarm-error', "ARC event="+_message.event+", "+_message.property+"="+_message.propertyValue);
   }
   else if (this.eventHandlers.hasOwnProperty(_message.event)) {
      this.eventHandlers[_message.event].call(this, _message);
   }
   else {
      console.log(this.uName+": message received that had no property: \""+_message.description+"\"");
      this.updateProperty('alarm-error', "ARC event not handled. Event="+_message.event+", qual="+_message.qualifier);
   }
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

         if (_propValue == STATE_NIGHT_ARM) {
            // We don't allow NIGHT arm right now, just HOME and AWAY
            this.rejectPropertyUpdate(_propName);
         }
         else if (_propValue != this.props['current-state'].value) {

            if (((this.props['current-state'].value === STATE_STAY_ARM) && (this.props['target-state'].value === STATE_AWAY_ARM)) ||
                ((this.props['current-state'].value === STATE_AWAY_ARM) && (this.props['target-state'].value === STATE_STAY_ARM))) {

               // Don't allow this state transition AWAY<-direct-to->HOME, must go via DISARMED state - just move to disarmed state
               this.setNextPropertyValue(_propName, STATE_DISARMED);
            }
            else {
               setTimeout(function(_this) {	// Make sure the target-state is set before executing request
                  _this.moveTowardsTargetState();
               }, 100, this);
            }
         }
         else if (this.armingState != "idle") {

            setTimeout(function(_this) {	// Make sure the target-state is set before executing request
               _this.cancelOngoingRequest();
            }, 100, this);
         }
      }
   }

   if (_propName == "armed-normal" && !_propValue) {
      this.updateProperty("zone-alarm", false);
      this.updateProperty("confirmed-alarm", false);
   }
   else if (_propName == "part-armed" && _propValue && this.props['target-state'].value != STATE_STAY_ARM) {
      this.armingState = "idle";
      this.updateProperty("target-state", STATE_STAY_ARM);
      this.updateProperty("current-state", STATE_STAY_ARM);
   }
   else if (_propName == "part-armed" && !_propValue && this.props['target-state'].value != STATE_DISARMED) {
      this.armingState = "idle";
      this.updateProperty("target-state", STATE_DISARMED);
      this.updateProperty("current-state", STATE_DISARMED);
   }
   else if (_propName == "fully-armed" && _propValue && this.props['target-state'].value != STATE_AWAY_ARM) {
      this.armingState = "idle";
      this.updateProperty("target-state", STATE_AWAY_ARM);
      this.updateProperty("current-state", STATE_AWAY_ARM);
   }
   else if (_propName == "fully-armed" && !_propValue && this.props['target-state'].value != STATE_DISARMED) {
      this.armingState = "idle";
      this.updateProperty("target-state", STATE_DISARMED);
      this.updateProperty("current-state", STATE_DISARMED);
   }
   else if (_propName == "part-armed") {
      this.armingState = "idle";
      this.updateProperty("current-state", (_propValue) ? STATE_STAY_ARM : STATE_DISARMED);
   }
   else if (_propName == "fully-armed") {
      this.armingState = "idle";
      this.updateProperty("current-state", (_propValue) ? STATE_AWAY_ARM : STATE_DISARMED);
   }
   else if (_propName == "zone-alarm") {
      this.updateProperty("current-state", (_propValue) ? STATE_ALARM_TRIGGERED : STATE_DISARMED);
   }
};

AlarmTexecom.prototype.moveTowardsTargetState = function(_forceState) {
   var that = this;

   if (!_forceState && this.armingState !== "idle") {
      console.log(this.uName+": Already requesting another action - cancelling it!");
      this.cancelOngoingRequest();
      return;
   }

   if (!_forceState && (this.props['target-state'].value === this.props['current-state'].value)) {
      console.log(this.uName+": States already in sync, job done!");
      return;
   }

   this.targetState = (_forceState) ? _forceState : this.props['target-state'].value;

   console.log(this.uName+": Attempting to move states from current state:"+this.props['current-state'].value+
               " to target state:"+this.targetState);

   this.armingState = "connecting";
   console.log(this.uName + ': Connecting to Texecom alarm');
   console.log(this.uName + ': Connecting to ip='+this.alarmAddress+' port='+this.alarmPort);

   this.socket = net.createConnection({ port: this.alarmPort, host: this.alarmAddress });

   this.socket.on('connect', function(_buffer) {
      console.log(this.uName + ': Connected to alarm');
      that.armingState = "connected";

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
      that.armingState = "idle";
   });
};

AlarmTexecom.prototype.cancelOngoingRequest = function() {
   var buffer;

   switch (this.armingState) {
      case "connecting":
      case "connected":
      case "logged-into-panel":
      case "logged-in-as-user":
      case "logging-into-panel":
      case "logging-in-as-user":
         clearTimeout(this.responseTimer);
         this.responseTimer = null;
         this.failedToSendCommand();
         this.moveTowardsTargetState();
         break;
      case "attempting-to-part-arm":
      case "attempting-to-arm":
      case "attempting-to-disarm":
	 // Do Nothing
         this.requestCancelled = true;
         break;
      case "part-arm-req-acked":
      case "fully-arm-req-acked":
         this.moveTowardsTargetState(STATE_DISARMED);
         break;
      default:
         console.log(this.uName + ": Not able to send data to alarm and not it the right state. Current state: "+this.armingState);
   }
};

AlarmTexecom.prototype.sendNextMessage = function() {
   var buffer;

   switch (this.armingState) {
      case "idle":
         break;
      case "connected":
         this.armingState = "logging-into-panel";
         this.sendToAlarm(Buffer.from("\\W"+this.udl+"/", 'ascii')); 	// Panel login
         break;
      case "logged-into-panel":
         this.armingState = "logging-in-as-user";
         buffer = Buffer.from("\\X3 /", 'ascii');
         buffer[3] = this.userNumber;
         this.sendToAlarm(buffer); 	// User login
         break;
      case "logged-in-as-user":
         if (this.targetState == STATE_STAY_ARM) {
            this.armingState = "attempting-to-part-arm";
            buffer = Buffer.from("\\Y  /", 'ascii');
         }
         else if (this.targetState == STATE_AWAY_ARM) {
            this.armingState = "attempting-to-arm";
            buffer = Buffer.from("\\A  /", 'ascii');
         }
         else if (this.targetState == STATE_DISARMED) {
            this.armingState = "attempting-to-disarm";
            buffer = Buffer.from("\\D  /", 'ascii');
         }
         buffer[2] = 1;
         buffer[3] = 0;
         this.sendToAlarm(buffer);
         break;
      default:
         console.log(this.uName + ": Not able to send data to alarm and not it the right state. Current state: "+this.armingState);
         this.failedToSendCommand();
   }
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

   switch (this.armingState) {
      case "logging-into-panel":
         if (_buffer.equals(Buffer.from([0x4f, 0x4b, 0x0d, 0x0a], 'ascii'))) {
            this.armingState = "logged-into-panel";
            console.log(this.uName + ": Logged into panel successfully");
            this.sendNextMessage();
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm panel - Check UDL");
            this.failedToSendCommand();
         }
         break;
      case "logging-in-as-user":
         if ((_buffer.length >= 25) && (_buffer[9] != 0xff) && (_buffer[10] != 0xee)) {
            this.armingState = "logged-in-as-user";
            console.log(this.uName + ": Logged in to panel as a user successfully");
            this.sendNextMessage();
         }
         else {
            console.log(this.uName + ": Unable to log into Texecom alarm user - Check User Number");
            this.failedToSendCommand();
         }
         break;
      case "attempting-to-part-arm":
      case "attempting-to-arm":
         if (_buffer.equals(Buffer.from([0x4f, 0x4b, 0x0d, 0x0a], 'ascii'))) {
            this.armingState = (this.targetState == STATE_STAY_ARM) ? "part-arm-req-acked" : "fully-arm-req-acked";
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
         if (_buffer.equals(Buffer.from([0x4f, 0x4b, 0x0d, 0x0a], 'ascii'))) {
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
      default:
         console.log(this.uName + ": Not able to process data from alarm and not it the right state. Current state: "+this.armingState);
         this.failedToSendCommand();
   }
};

AlarmTexecom.prototype.restartProcess = function(_timeout, _state) {
   this.socket.destroy();

   if (_state) {
      this.armingState = _state;
   }

   setTimeout(function(_this) {
      _this.moveTowardsTargetState();
   }, _timeout, this);
};

AlarmTexecom.prototype.failedToSendCommand = function() {

   if (this.armingState !== "idle") {
      this.armingState = "idle";
      this.socket.destroy();
      this.updateProperty('target-state', this.props['current-state'].value);
   }
};

AlarmTexecom.prototype.alarmAbortHandler = function(_event) {

   if (this.props["part-armed"].value) {
      this.updateProperty("part-armed", false);
   }
   else if (this.props["fully-armed"].value) {
      this.updateProperty("fully-armed", false);
   }
  
   if (this.props["armed-normal"].value) {
      this.updateProperty("armed-normal", false);
   }
};

AlarmTexecom.prototype.exitErrorHandler = function(_event) {

   if (this.armingMode != "idle") {
      this.updateProperty("target-state", STATE_DISARMED);
   }
};

module.exports = exports = AlarmTexecom;
