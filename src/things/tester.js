var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function Tester(_config) {
   Thing.call(this, _config);
   this.thingType = "testsequence";

   this.currentTestCase = 0;
   this.currentTestStep = 0;

   this.expectedPosition = 0;

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {
      this.constructing = true;

      for (var index = 0; index < _config.sources.length; ++index) {
         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
         this.noOfSources++;
      }

      this.constructing = false;
   }

   this.testCases = _config.testCases;
}

util.inherits(Tester, Thing);

Tester.prototype.coldStart = function() {
   this.initiateTestStep();
};

Tester.prototype.initiateTestStep = function(_cold) {

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("wait")) {

      setTimeout( () => {
         this.runTestStep();
      }, this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].wait * 1000);
   }
   else {
      this.runTestStep();
   }
};

Tester.prototype.initiateNextTestStep = function() {

   if (++this.currentTestStep < this.testCases[this.currentTestCase].driveSequence.length) {
      this.initiateTestStep();
   }
};

Tester.prototype.runTestStep = function() {

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("event")) {
      this.raiseEvent(this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].event);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("property")) {
      this.alignPropertyValue(this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].property, this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].value);
   }

   this.initiateNextTestStep();
};

Tester.prototype.sourceIsInvalid = function(_data) {
   console.error(this.uName + ': TEST FAILED - Source invalid');
   process.exit(5);
};

Tester.prototype.sourceIsValid = function(_data) {
}

Tester.prototype.receivedEventFromSource = function(_data) {

   if (!_data.coldStart) {

      if ((_data.sourceName === this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition].source) &&
          (_data.name === this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition].property) &&
          (_data.value === this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition].value)) {

         console.info(this.uName + ": STEP " + (this.expectedPosition + 1) + " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED");
      }
      else {
         console.error(this.uName + ": STEP " + (this.expectedPosition + 1) + " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {
         console.info(this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " PASSED");

         if (++this.currentTestCase < this.testCases.length) {
            this.currentTestStep = 0;
            this.expectedPosition = 0;
            this.initiateTestStep();
         }
         else {
            console.info(this.uName + ": ALL TEST CASES (" + this.currentTestCase + ") PASSED");
            process.exit(0);
         }
      }
   }
};

module.exports = exports = Tester;
