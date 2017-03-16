var util = require('util');
var Thing = require('../thing');
var speedTest = require('speedtest-net');
var schedule = require('node-schedule');

function BroadbandSpeedTester(_config) {
   Thing.call(this, _config);

   this.maxTime = (_config.hasOwnProperty('maxTime')) ? _config.maxTime : 10000;
   this.schedule = (_config.hasOwnProperty('schedule')) ? _config.schedule : "0 2 * * *";	// 2am Everyday

   this.ensurePropertyExists('upload-speed', 'property', { initialValue: 0 });
   this.ensurePropertyExists('download-speed', 'property', { initialValue: 0 });
   this.ensurePropertyExists('ping-time', 'property', { initialValue: 0 });
   this.ensurePropertyExists('server-address', 'property', { initialValue: '' });
   this.ensurePropertyExists('test-result', 'property', { initialValue: '' });
}

util.inherits(BroadbandSpeedTester, Thing);

BroadbandSpeedTester.prototype.testSpeed = function() {
   var test = speedTest({ maxTime: this.maxTime });
   var that = this;

   test.on('data', function(_data) {

      if (_data.hasOwnProperty('speeds')) {
         that.props['download-speed'].setProperty(_data.speeds.download, { sourceName: that.uName });
         that.props['upload-speed'].setProperty(_data.speeds.upload, { sourceName: that.uName });

         if (_data.hasOwnProperty('server')) {
            that.props['ping-time'].setProperty(_data.server.ping, { sourceName: that.uName });
            that.props['server-address'].setProperty(_data.server.host, { sourceName: that.uName });

            that.props['test-result'].setProperty('Speed Test: D=' + _data.speeds.download +
                                                  ' U=' + _data.speeds.upload +
                                                  ' P=' + _data.server.ping, { sourceName: that.uName });
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

};

module.exports = exports = BroadbandSpeedTester;
