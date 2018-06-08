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

   if (_config.hasOwnProperty("testRun")) {
      this.testCases = [];

      for (var i = 0; i < _config.testRun.length; ++i) {
         this.testCases.push(_config.testCases[_config.testRun[i]]);
      }
   }
   else {
      this.testCases = _config.testCases;
   }
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

Tester.prototype.matchExpectedEvent = function(_data, _index) {
   var name;

   if (this.testCases[this.currentTestCase].expectedSequence[_index].hasOwnProperty('property')) {
      name = this.testCases[this.currentTestCase].expectedSequence[_index].property;
   }
   else {
      name = this.testCases[this.currentTestCase].expectedSequence[_index].event;
   }

   return ((_data.sourceName === this.testCases[this.currentTestCase].expectedSequence[_index].source) &&
       (_data.name === name) && (_data.value === this.testCases[this.currentTestCase].expectedSequence[_index].value));
};

Tester.prototype.receivedEventFromSource = function(_data) {

   if (!_data.coldStart) {
      let result = false;
      let fuzzFactor = 0;

      if (this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition].hasOwnProperty('fuzz')) {
         fuzzFactor = this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition].fuzz;
      }

      for (var i = this.expectedPosition; (i <= (this.expectedPosition + fuzzFactor)) && (i < this.testCases[this.currentTestCase].expectedSequence.length); ++i) {
         result = this.matchExpectedEvent(_data, i);

         if (result) {

            if (i !== this.expectedPosition) {
               let temp = this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition];
               this.testCases[this.currentTestCase].expectedSequence[this.expectedPosition] = this.testCases[this.currentTestCase].expectedSequence[i];
               this.testCases[this.currentTestCase].expectedSequence[i] = temp;
               this.testCases[this.currentTestCase].expectedSequence[i].fuzz = 0;
            }
            break;
         }
      }

      if (result) {
         console.info(this.uName + ": TC"+ (this.currentTestCase + 1) + " STEP " + (this.expectedPosition + 1) +
                      " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED");
      }
      else {
         console.error(this.uName + ": TC"+ (this.currentTestCase + 1) + " STEP " + (this.expectedPosition + 1) +
                       " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {

         if ((this.timeout) || (this.currentTestStep < this.testCases[this.currentTestCase].driveSequence.length - 1)) {
            console.info(this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " FAILED as all expected events have occurred but drive sequence not complete");
            process.exit(5);
         }

         console.info(this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " PASSED");

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
