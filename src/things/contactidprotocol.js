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

function ContactIdProtocol(_uName) {
   this.uName = _uName;

   this.QUALIFIERS = {
      1 : 'Event/Activated',
      3 : 'Restore/Secured',
      6 : 'Status'
   };

   this.EVENTS = {
      100: { name: 'Medical', property: 'medical-alarm' },
      110: { name: 'Fire', property: 'fire-alarm' },
      120: { name: 'Panic', property: 'panic-alarm' },
      121: { name: 'Duress', property: 'duress-alarm' },
      122: { name: 'Silent Attack', property: 'attack-alarm' },
      123: { name: 'Audible Attack', property: 'attack-alarm' },
      130: { name: 'Intruder', property: 'zone-alarm' },
      131: { name: 'Perimeter', property: 'zone-alarm' },
      132: { name: 'Interior', property: 'zone-alarm' },
      133: { name: '24 Hour', },
      134: { name: 'Entry/Exit', property: 'in-exit-entry' },
      135: { name: 'Day/Night'},
      136: { name: 'Outdoor'},
      137: { name: 'Zone Tamper', property: 'tamper-alarm' },
      139: { name: 'Confirmed Alarm', property: 'confirmed-alarm' },
      145: { name: 'System Tamper', property: 'tamper-alarm' },

      300: { name: 'System Trouble', property: 'system-failure' },
      301: { name: 'AC Lost', property: 'ac-power-failure' },
      302: { name: 'Low Battery', property: 'battery-failure' },
      305: { name: 'System Power Up', property: 'ac-power-failure', value: false },
      320: { name: 'Mains Over-voltage', property: 'alarm-error', value: 'Mains Over-voltage' },
      333: { name: 'Network Failure', property: 'alarm-error', value: 'Network Failure' },
      351: { name: 'ATS Path Fault', property: 'alarm-error', value: 'ATS Path Fault' },
      354: { name: 'Failed to Communicate', property: 'alarm-error', value: 'Failed to Communicate' },
      355: { name: 'Radio Supervision Failure', property: 'alarm-error', value: 'Radio Supervision Failure' },
      384: { name: 'Zone Sensor Battery Low', property: 'alarm-error', value: 'Zone Sensor Battery Low' },

      400: { name: 'Arm/Disarm', property: 'armed-normal', qualifiers: { 1: false, 3: true } },
      401: { name: 'Arm/Disarm by User', property: 'armed-normal', qualifiers: { 1: false, 3: true } },
      402: { name: 'Arm/Disarm by User', property: 'armed-normal', qualifiers: { 1: false, 3: true } },
      403: { name: 'Automatic Arm/Disarm', property: 'armed-normal', qualifiers: { 1: false, 3: true } },

      406: { name: 'Alarm Abort' },

      407: { name: 'Remote Arm/Disarm', property: 'armed-normal', qualifiers: { 1: false, 3: true } },
      408: { name: 'Quick Arm', property: 'armed-normal', qualifiers: { 1: false, 3: true } },

      411: { name: 'Download Start' },
      412: { name: 'Download End', },
      441: { name: 'Part Arm', property: 'part-armed', qualifiers: { 1: false, 3: true } },

      457: { name: 'Exit Error' },
      459: { name: 'Recent Closing' },
      570: { name: 'Zone Locked Out', property: 'alarm-error', value: 'Zone Locked Out' },

      601: { name: 'Manual Test' },
      602: { name: 'Periodic Test' },
      607: { name: 'User Walk Test' },

      623: { name: 'Log Capacity Alert', property: 'alarm-error', value: 'Log Capacity Alert' },
      625: { name: 'Date/Time Changed', },
      627: { name: 'Program Mode Entry', property: 'engineer-mode' },
      628: { name: 'Program Mode Exit', property: 'engineer-mode', value: false },
   }
}

ContactIdProtocol.prototype.decodeMessage = function(_msg) {
   var message = { protocol: 'ContactID'};

   // Validate
   if (!((_msg.length == 16) || (_msg.length == 12))) {
      console.log(this.uName + ": Invalid message size " + _msg.length);
      return undefined;
   }

   if (_msg.slice(4,6) != '18' && _msg.slice(4,6) != '98' && _msg.slice(4,6) != 'A1') {
      console.log(this.uName + ": Invalid message type " + _msg.slice(4,6));
      return undefined;
   }

   message.accountNumber = _msg.slice(0,4).toString().replace(/A/g, '0');
   message.qualifier = _msg.slice(6,7);
   message.eventNum = _msg.slice(7,10);

   if (isNaN(message.qualifier) || isNaN(message.eventNum)) {
      console.log(this.uName + ": Unable to parse event!");
      return undefined;
   }

   if (_msg.length == 16) {
      message.area = _msg.slice(10,12).toString();
      message.value = _msg.slice(12,15).toString();

      if (isNaN(message.area) || isNaN(message.value)) {
         console.log(this.uName + ": Unable to parse event!");
         return undefined;
      }
   }
   else {
      message.area = "ALL";
      message.value = "XX";
   }

   var qualstr = (this.QUALIFIERS[message.qualifier] == undefined) ? '' : this.QUALIFIERS[message.qualifier];
   var eventStr;

   if (this.EVENTS[message.eventNum] != undefined) {
      eventStr = this.EVENTS[message.eventNum].name;
      message.property = this.EVENTS[message.eventNum].property;

      if (this.EVENTS[message.eventNum].value != undefined) {
         message.propertyValue = this.EVENTS[message.eventNum].value;
      }
      else if (this.EVENTS[message.eventNum].qualifiers) {
         message.propertyValue = this.EVENTS[message.eventNum].qualifiers[message.qualifier];
      }
      else {
         message.propertyValue = true;
      }
   }
   else {
      eventStr = 'Unknown Event '+message.eventNum;
   }

   message.event = message.eventNum;
   message.description = eventStr + qualstr;
   message.valueName = 'Zone/User';
   return message;
};

module.exports = exports = ContactIdProtocol;
