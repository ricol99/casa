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
var Thing = require('./thing');
var net = require('net');
var ContactIdProtocol = require('./contactidprotocol');
var SIAProtocol = require('./siaprotocol');

function TexecomAlarm(_config) {

   Thing.call(this, _config);

   this.port = _config.port;
   this.pollingInterval = _config.pollingInterval * 1000 * 60;   // mins into ms
   this.maxPollMisses = (_config.maxPollMisses == undefined) ? 3 : _config.maxPollMisses;
   this.alarmIp = _config.alarmIp;

   this.pollingTolerance = 30000;   // ms
   this.pollingTimeout = this.pollingInterval + this.pollingTolerance;

   this.decoders = { 2: new ContactIdProtocol("contactid:"+this.name), 3: new SIAProtocol("sia:"+this.name) };

   var that = this;
}

util.inherits(TexecomAlarm, Thing);

TexecomAlarm.prototype.newConnection = function(_socket) {
   var that = this;
   console.log(this.name + ": New connection from Texecom Alarm at address " + _socket.remoteAddress);

  _socket.on('data', function (_data) {
     console.log("DATA:",_data);

     if (_data.slice(0,3) == '+++') {
        return;
     }

     if (_data.slice(-2) != '\r\n') {
        console.log(that.name + ": Ignoring line with missing terminator");
        return;
     }
     var newData = _data.slice(0,-2);

     if (newData.slice(0,4) == 'POLL') {
        handlePollEvent(that, _socket, newData);
     }
     else if (that.decoders[newData.slice(0,1)] != undefined) {
        var message = that.decoders[newData.slice(0,1)].decodeMessage(newData.slice(1));
        handleMessage(that, _socket, message, newData);
     }
     else {
        console.log(that.name + ": Unhandled Message");
     }
  });
};


TexecomAlarm.prototype.coldStart = function(_event) {
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

function handlePollEvent(_this, _socket, _data) {
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
   buf.writeInt16BE(_this.pollingInterval / 1000 / 60,3)
   _socket.write(buf);
   
   if (_this.pollsMissed > 0) {
      console.log(_this.name + ": Polling recovered (within tolerance) with Texecom alarm!");
      _this.pollsMissed = 0;
   }

   _this.updateProperty('ACTIVE', true, { sourceName: _this.name });

   // More props to update here!  XXXX
   if (flags & FLAG_AC_FAILURE) {
      console.log(_this.name + ": Poll event received AC Failure");
   }

   if (flags & FLAG_BATTERY_FAILURE) {
      console.log(_this.name + ": Poll event received Battery Failure");
   }

   if (flags & FLAG_ARMED) {
      console.log(_this.name + ": Poll event received Alarm armed");
   }

   info = {
      flags_raw: flags,
      line_failure: (flags & FLAG_LINE_FAILURE) > 0,
      ac_failure: (flags & FLAG_AC_FAILURE) > 0,
      battery_failure: (flags & FLAG_BATTERY_FAILURE) > 0,
      armed: (flags & FLAG_ARMED) > 0,
      engineer: (flags & FLAG_ENGINEER) > 0
   };

   restartWatchdog(_this);
}

function handleMessage(_this, _socket, _message, _data) {

   console.log("%s: a/c %s area %d %s %s %d %s" , _message.protocol, _message.accountNumber, _message.area, _message.event, _message.valueName, _message.value, _message.extraText);

   if (_message.description != undefined) {
      console.log(_this.name + ": Message description: " + _message.description);
   }

   // Send ACK
   buf = new Buffer('00060d0a', 'hex');
   buf[0] = _data[0];
   _socket.write(buf);

   info = {
      area: _message.area,
      event: _message.event,
      value: _message.value,
      valueType: _message.valueName,
      extraText: _message.extraText
   };

   if (_message.extraText) {
      console.log(_this.name + ": Extra message text: " + _message.extraText);
   }
}

function restartWatchdog(_that) {

   if (_that.watchdog) {
      clearTimeout(_that.watchdog);
   }

   _that.watchdog = setTimeout(function(_this) {
      _this.watchdog = undefined;
      _this.pollsMissed++;

      if (_this.pollsMissed > _this.maxPollMisses) {
         // Lost connection with alarm
         console.info(_this.name + ": Lost connection to Texecom Alarm!");
         _this.updateProperty('ACTIVE', false, { sourceName: _this.name });
      }
      else {
         restartWatchdog(_this);
      }

   }, _that.pollingTimeout, _that);
}

function stopWatchdog(_this) {

   if (_this.watchdog) {
      _this.clearTimeout(_this.watchdog);
      _this.watchdog = undefined;
   }
}

module.exports = exports = TexecomAlarm;
