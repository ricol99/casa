var util = require('util');
var Thing = require('../thing');
var speedTest = require('speedtest-net');
var schedule = require('node-schedule');

function BroadbandSpeedTester(_config) {
   Thing.call(this, _config);

   this.maxTime = (_config.hasOwnProperty('maxTime')) ? _config.maxTime : 10000;
   this.schedule = (_config.hasOwnProperty('schedule')) ? _config.schedule : "0 2 * * *";	// 2am Everyday

   this.ensurePropertyExists('upload-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('download-speed', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('ping-time', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('server-address', 'property', { initialValue: '' }, _config);
   this.ensurePropertyExists('test-result', 'property', { initialValue: '' }, _config);
}

util.inherits(BroadbandSpeedTester, Thing);

BroadbandSpeedTester.prototype.testSpeed = function() {
   var test = speedTest({ maxTime: this.maxTime });
   var that = this;

   test.on('data', function(_data) {

      if (_data.hasOwnProperty('speeds')) {
         that.updateProperty('download-speed', _data.speeds.download);
         that.updateProperty('upload-speed', _data.speeds.upload);

         if (_data.hasOwnProperty('server')) {
            that.updateProperty('ping-time', _data.server.ping);
            that.updateProperty('server-address', _data.server.host);

            that.updateProperty('test-result', 'Speed Test: D=' + _data.speeds.download +
                                ' U=' + _data.speeds.upload + ' P=' + _data.server.ping);
         }
      }
   });

   test.on('error', function(_err) {
      console.error(that.uName + ": Error performing speed test. Error: " + _err);
   });
};

BroadbandSpeedTester.prototype.coldStart = function() {
   var that = this;

   console.log(this.uName+': Broadband speed test scheduled');
   var refreshJob = schedule.scheduleJob(this.schedule, function() {
      console.log(that.uName+': Testing broadband speed');
      that.testSpeed();
   });

   Thing.prototype.coldStart.call(this);
};

module.exports = exports = BroadbandSpeedTester;
