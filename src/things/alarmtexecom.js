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
var Alarm = require('alarm');
var net = require('net');
var ContactIdProtocol = require('./contactidprotocol');
var SIAProtocol = require('./siaprotocol');

function AlarmTexecom(_config) {

   Alarm.call(this, _config);

   this.port = _config.port;
   this.pollingInterval = _config.pollingInterval * 1000 * 60;   // mins into ms
   this.maxPollMisses = (_config.maxPollMisses == undefined) ? 3 : _config.maxPollMisses;
   this.alarmIp = _config.alarmIp;

   this.props['ACTIVE'].value = false;
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
   this.ensurePropertyExists('armed-part', 'property', { initialValue: false });
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

}

util.inherits(AlarmTexecom, Alarm);

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

      if ((that.alarmIp && _socket.remoteAddress === that.alarmIp) || (!that.alarmIp)) {
         that.newConnection(_socket);
      }
      else {
         _socket.destroy();
      }
   });

   this.server.listen(this.port);
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
      this.updateProperty('ACTIVE', true, { sourceName: this.uName });
   }

   if (((flags & FLAG_LINE_FAILURE) != 0) != this.props['line-failure'].value) {
      this.updateProperty('line-failure', ((flags & FLAG_LINE_FAILURE) != 0), { sourceName: this.uName });
   }

   if (((flags & FLAG_AC_FAILURE) != 0) != this.props['ac-power-failure'].value) {
      this.updateProperty('ac-power-failure', ((flags & FLAG_AC_FAILURE) != 0), { sourceName: this.uName });
   }

   if (((flags & FLAG_BATTERY_FAILURE) != 0) != this.props['battery-failure'].value) {
      this.updateProperty('battery-failure', ((flags & FLAG_BATTERY_FAILURE) != 0), { sourceName: this.uName });
   }

   if (((flags & FLAG_ARMED) != 0) != this.props['armed-normal'].value) {
      this.updateProperty('armed-normal', ((flags & FLAG_ARMED) != 0), { sourceName: this.uName });
   }

   if (((flags & FLAG_ENGINEER) != 0) != this.props['engineer-mode'].value) {
      this.updateProperty('engineer-mode', ((flags & FLAG_ENGINEER) != 0), { sourceName: this.uName });
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
      this.updateProperty(_message.property, _message.propertyValue, { sourceName: this.uName }); 
      console.log(this.uName+": Message received, event="+_message.event+" - "+ _message.description);
   }
   else {
      console.log(this.uName+": message received that had no property: \""+_message.description+"\"");
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
         _this.updateProperty('ACTIVE', false, { sourceName: _this.uName });
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

module.exports = exports = AlarmTexecom;
