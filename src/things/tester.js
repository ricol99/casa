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

      this.timeout = setTimeout( () => {
         this.timeout = null;
         this.runTestStep();
      }, this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].wait * 1000);
   }
   else {
      this.runTestStep();
   }
};

Tester.prototype.initiateNextTestStep = function() {
   console.log("initiateNextTestStep(): called - tc="+this.currentTestCase+" ts="+this.currentTestStep);

   if (this.currentTestStep < this.testCases[this.currentTestCase].driveSequence.length - 1) {
      ++this.currentTestStep;
      this.initiateTestStep();
   }
};

Tester.prototype.runTestStep = function() {
   console.log("runTestStep(): called - tc="+this.currentTestCase+" ts="+this.currentTestStep);
   var tc = this.currentTestCase;
   var target = this;

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("target")) {
      target = this.gang.findSource(this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].target);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("event")) {
      target.raiseEvent(this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].event);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].hasOwnProperty("property")) {
      target.alignPropertyValue(this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].property, this.testCases[this.currentTestCase].driveSequence[this.currentTestStep].value);
   }

   if (tc == this.currentTestCase) {
      this.initiateNextTestStep();
   }
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

         console.info(this.uName + ": TC"+ (this.testCases.length - this.currentTestCase) + " STEP " + (this.expectedPosition + 1) +
                      " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED");
      }
      else {
         console.error(this.uName + ": TC"+ (this.testCases.length - this.currentTestCase) + " STEP " + (this.expectedPosition + 1) +
                       " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {

         if ((this.timeout) || (this.currentTestStep < this.testCases[this.currentTestCase].driveSequence.length - 1)) {
            console.info(this.uName + ": TEST CASE " + (this.testCases.length - this.currentTestCase) + " FAILED as all expected events have occurred but drive sequence not complete");
            process.exit(5);
         }

         console.info(this.uName + ": TEST CASE " + (this.testCases.length - this.currentTestCase) + " PASSED");

         if (++this.currentTestCase < this.testCases.length) {
            this.currentTestStep = 0;
            this.expectedPosition = 0;
            this.initiateTestStep();
         }
         else {
            console.info(this.uName + ": ALL TEST CASES (" + this.testCases.length + ") PASSED");
            process.exit(0);
         }
      }
   }
};

module.exports = exports = Tester;
