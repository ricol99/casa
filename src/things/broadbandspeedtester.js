var util = require('util');
var Thing = require('../thing');
var speedTest = require('speedtest-net');

function BroadbandSpeedTester(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.maxTime = (_config.hasOwnProperty('maxTime')) ? _config.maxTime : 10000;

   this.ensurePropertyExists('upload-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('download-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('ping-time', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('server-address', 'property', { initialValue: '' }, _config);
   this.ensurePropertyExists('test-result', 'property', { initialValue: '' }, _config);
}

util.inherits(BroadbandSpeedTester, Thing);

BroadbandSpeedTester.prototype.testSpeed = function() {
   try {
      var test = speedTest({ maxTime: this.maxTime });

      test.on('data', (_data) => {

         if (_data.hasOwnProperty('speeds')) {
            this.alignPropertyValue('download-speed', _data.speeds.download);
            this.alignPropertyValue('upload-speed', _data.speeds.upload);

            if (_data.hasOwnProperty('server')) {
               this.alignPropertyValue('ping-time', _data.server.ping);
               this.alignPropertyValue('server-address', _data.server.host);

               this.alignPropertyValue('test-result', 'Speed Test: D=' + _data.speeds.download +
                                       ' U=' + _data.speeds.upload + ' P=' + _data.server.ping);
            }
         }
      });
   
      test.on('error', (_err) => {
         console.error(this.uName + ": Error performing speed test. Error: " + _err);
      });

   }
   catch (_err) {
      console.error(this.uName + ": Error performing speed test. Error: " + _err);
   }
};

BroadbandSpeedTester.prototype.scheduledEventTriggered = function(_event) {
   console.log(this.uName+': Testing broadband speed');
   this.testSpeed();
}

module.exports = exports = BroadbandSpeedTester;
