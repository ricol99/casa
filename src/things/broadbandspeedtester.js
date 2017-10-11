var util = require('util');
var CasaSystem = require('../casasystem');
var Thing = require('../thing');
var speedTest = require('speedtest-net');

function BroadbandSpeedTester(_config) {
   Thing.call(this, _config);

   this.maxTime = (_config.hasOwnProperty('maxTime')) ? _config.maxTime : 10000;
   this.schedule = (_config.hasOwnProperty('schedule')) ? _config.schedule : "0 2 * * *";	// 2am Everyday

   this.ensurePropertyExists('upload-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('download-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('ping-time', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('server-address', 'property', { initialValue: '' }, _config);
   this.ensurePropertyExists('test-result', 'property', { initialValue: '' }, _config);

   var casaSys = CasaSystem.mainInstance();
   this.scheduleService =  casaSys.findService("scheduleservice");

   if (!this.scheduleService) {
      console.error(this.uName + ": ***** Schedule service not found! *************");
      process.exit();
   }
}

util.inherits(BroadbandSpeedTester, Thing);

BroadbandSpeedTester.prototype.testSpeed = function() {
   var test = speedTest({ maxTime: this.maxTime });
   var that = this;

   test.on('data', function(_data) {

      if (_data.hasOwnProperty('speeds')) {
         that.alignPropertyValue('download-speed', _data.speeds.download);
         that.alignPropertyValue('upload-speed', _data.speeds.upload);

         if (_data.hasOwnProperty('server')) {
            that.alignPropertyValue('ping-time', _data.server.ping);
            that.alignPropertyValue('server-address', _data.server.host);

            that.alignPropertyValue('test-result', 'Speed Test: D=' + _data.speeds.download +
                                    ' U=' + _data.speeds.upload + ' P=' + _data.server.ping);
         }
      }
   });

   test.on('error', function(_err) {
      console.error(that.uName + ": Error performing speed test. Error: " + _err);
   });
};

BroadbandSpeedTester.prototype.coldStart = function() {
   console.log(this.uName+': Broadband speed test scheduled');
   this.scheduleService.registerEvents(this, [{ name: this.uName+":schedule", rule: this.schedule }]);

   Thing.prototype.coldStart.call(this);
};

BroadbandSpeedTester.prototype.scheduledEventTriggered = function(_event) {
   console.log(this.uName+': Testing broadband speed');
   this.testSpeed();
}

module.exports = exports = BroadbandSpeedTester;
