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
var Property = require('./property');
var net = require('net');
var ContactIdProtocol = require('./contactidprotocol');
var SIAProtocol = require('./siaprotocol');

function TexecomAlarm(_config) {

   Thing.call(this, _config);

   this.port = _config.port;
   this.pollingInterval = _config.pollingInterval * 1000 * 60;   // mins into ms
   this.maxPollMisses = (_config.maxPollMisses == undefined) ? 3 : _config.maxPollMisses;
   this.alarmIp = _config.alarmIp;

   this.props['ACTIVE'].value = false;
   this.props['line-failure']  = new Property({ name: 'line-failure', type: 'property', initialValue: false }, this);
   this.props['ac-power-failure']  = new Property({ name: 'ac-power-failure', type: 'property', initialValue: false }, this);
   this.props['battery-failure']  = new Property({ name: 'battery-failure', type: 'property', initialValue: false }, this);
   this.props['line-failure']  = new Property({ name: 'line-failure', type: 'property', initialValue: false }, this);
   this.props['fire-alarm']  = new Property({ name: 'fire-alarm', type: 'property', initialValue: false }, this);
   this.props['medical-alarm']  = new Property({ name: 'medical-alarm', type: 'property', initialValue: false }, this);
   this.props['panic-alarm']  = new Property({ name: 'panic-alarm', type: 'property', initialValue: false }, this);
   this.props['duress-alarm']  = new Property({ name: 'duress-alarm', type: 'property', initialValue: false }, this);
   this.props['attack-alarm']  = new Property({ name: 'attack-alarm', type: 'property', initialValue: false }, this);
   this.props['carbon-monoxide-alarm']  = new Property({ name: 'carbon-monoxide-alarm', type: 'property', initialValue: false }, this);
   this.props['tamper-alarm']  = new Property({ name: 'tamper-alarm', type: 'property', initialValue: false }, this);
   this.props['armed-normal']  = new Property({ name: 'armed-normal', type: 'property', initialValue: false }, this);
   this.props['armed-part']  = new Property({ name: 'armed-part', type: 'property', initialValue: false }, this);
   this.props['zone-alarm']  = new Property({ name: 'zone-alarm', type: 'property', initialValue: false }, this);
   this.props['confirmed-alarm']  = new Property({ name: 'confirmed-alarm', type: 'property', initialValue: false }, this);
   this.props['engineer-mode']  = new Property({ name: 'engineer-mode', type: 'property', initialValue: false }, this);

   this.pollingTolerance = 30000;   // ms
   this.pollingTimeout = this.pollingInterval + this.pollingTolerance;
   this.pollsMissed = 0;

   this.decoders = { 2: new ContactIdProtocol("contactid:"+this.uName), 3: new SIAProtocol("sia:"+this.uName) };

}

util.inherits(TexecomAlarm, Thing);

TexecomAlarm.prototype.newConnection = function(_socket) {
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
        handlePollEvent(that, _socket, newData);
     }
     else if (that.decoders[newData.slice(0,1)] != undefined) {
        var message = that.decoders[newData.slice(0,1)].decodeMessage(newData.slice(1));
        handleMessage(that, _socket, message, newData);
     }
     else {
        console.log(that.uName + ": Unhandled Message");
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
      console.log(_this.uName + ": Polling recovered (within tolerance) with Texecom alarm!");
      _this.pollsMissed = 0;
   }

   if (!_this.props['ACTIVE'].value) {
      console.log(_this.uName + ": Connection restored to Texecom alarm!");
      _this.updateProperty('ACTIVE', true, { sourceName: _this.uName });
   }

   if ((flags & FLAG_LINE_FAILURE != 0) != _this.props['line-failure'].value) {
      _this.updateProperty('line-failure', (flags & FLAG_LINE_FAILURE != 0), { sourceName: _this.uName });
   }

   if ((flags & FLAG_AC_FAILURE != 0) != _this.props['ac-power-failure'].value) {
      _this.updateProperty('ac-power-failure', (flags & FLAG_AC_FAILURE != 0), { sourceName: _this.uName });
   }

   if ((flags & FLAG_BATTERY_FAILURE != 0) != _this.props['battery-failure'].value) {
      _this.updateProperty('battery-failure', (flags & FLAG_BATTERY_FAILURE != 0), { sourceName: _this.uName });
   }

   if ((flags & FLAG_ARMED != 0) != _this.props['armed-normal'].value) {
      _this.updateProperty('armed-normal', (flags & FLAG_ARMED != 0), { sourceName: _this.uName });
   }

   if ((flags & FLAG_ENGINEER != 0) != _this.props['engineer-mode'].value) {
      _this.updateProperty('engineer-mode', (flags & FLAG_ENGINEER != 0), { sourceName: _this.uName });
   }

   console.log(this.uName + ": Poll received from alarm. Flags="+flags);
   restartWatchdog(_this);
}

function handleMessage(_this, _socket, _message, _data) {

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
      _this.updateProperty(_message.property, _message.propertyValue, { sourceName: _this.uName }); 
   }
}

function restartWatchdog(_that) {

   if (_that.watchdog) {
      clearTimeout(_that.watchdog);
      _that.pollsMissed = 0;
   }

   _that.watchdog = setTimeout(function(_this) {
      _this.watchdog = undefined;
      _this.pollsMissed++;

      if (_this.pollsMissed > _this.maxPollMisses) {
         // Lost connection with alarm
         console.info(_this.uName + ": Lost connection to Texecom Alarm!");
         _this.pollsMissed = 0;
         _this.updateProperty('ACTIVE', false, { sourceName: _this.uName });
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
