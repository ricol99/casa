var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function Tester(_config) {
   Thing.call(this, _config);
   this.thingType = "testsequence";
   this.config = _config;
   this.settleTime = _config.hasOwnProperty("settleTime") ? _config.settleTime : 3;

   this.currentTestCase = 0;
   this.currentTestEvent = 0;

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

   this.buildTestCases(_config.testRun, _config.testCases);
}

util.inherits(Tester, Thing);

Tester.prototype.coldStart = function() {
   this.initiateTestEvent();
};

Tester.prototype.findTestCaseStep = function(_name, _type) {

   if (this.config.hasOwnProperty(_type)) {

      for (var i = 0; i < this.config[_type].length; ++i) {

         if (this.config[_type][i].name === _name) {
            return this.config[_type][i];
         }
      }
   }
   return null;
};

Tester.prototype.replaceInnerTestCases = function(_testCaseStep) {

   for (var i = 0; i < _testCaseStep.driveSequence.length; ++i) {

      let innerTestCaseStep = null;

      if (_testCaseStep.driveSequence[i].hasOwnProperty("testCase")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.driveSequence[i].testCase, "testCases");
      }
      else if (_testCaseStep.driveSequence[i].hasOwnProperty("testStep")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.driveSequence[i].testCase, "testSteps");
      }

      if (innerTestCaseStep) {
         this.replaceInnerTestCases(innerTestCaseStep);
         _testCaseStep.driveSequence.splice(i, 1, ...innerTestCaseStep.driveSequence);
         i += innerTestCaseStep.driveSequence.length - 1;
      }
   }

   for (var j = 0; j < _testCaseStep.expectedSequence.length; ++j) {

      let innerTestCaseStep = null;

      if (_testCaseStep.expectedSequence[j].hasOwnProperty("testCase")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.expectedSequence[j].testCase, "testCases");
      }
      else if (_testCaseStep.expectedSequence[j].hasOwnProperty("testStep")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.expectedSequence[j].testCase, "testSteps");
      }

      if (innerTestCaseStep) {
         this.replaceInnerTestCases(innerTestCaseStep);
         _testCaseStep.expectedSequence.splice(j, 1, ...(innerTestCaseStep.expectedSequence));
         j += innerTestCaseStep.expectedSequence.length - 1;
      }
   }
};

Tester.prototype.buildTestCase = function(_testCase) {
   this.replaceInnerTestCases(_testCase);
   _testCase.driveSequence[0].wait = (_testCase.driveSequence[0].hasOwnProperty("wait")) ? _testCase.driveSequence[0].wait + this.settleTime : this.settleTime;
   this.testCases.push({ driveSequence: _testCase.driveSequence, expectedSequence: [] });

   for (var i = 0; i < _testCase.expectedSequence.length; ++i) {

      if (_testCase.expectedSequence[i].hasOwnProperty("simultaneous")) {
         var fuzzFactor = _testCase.expectedSequence[i].simultaneous.length - 1;

         for (var j = 0; j < _testCase.expectedSequence[i].simultaneous.length; ++j) {
            _testCase.expectedSequence[i].simultaneous[j].fuzz = fuzzFactor--;
            this.testCases[this.testCases.length - 1].expectedSequence.push(_testCase.expectedSequence[i].simultaneous[j]);
         }
      }
      else {
         this.testCases[this.testCases.length - 1].expectedSequence.push(_testCase.expectedSequence[i]);
      }
   }
};

Tester.prototype.buildTestCases = function(_testRun, _testCases) {
   this.testCases = [];

   if (_testRun) {

      for (var i = 0; i < _testRun.length; ++i) {
         this.buildTestCase(_testCases[_testRun[i]]);
      }
   }
   else {
      for (var j = 0; j < _testCases.length; ++j) {
         this.buildTestCase(_testCases[j]);
      }
   }
};

Tester.prototype.initiateTestEvent = function(_cold) {

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("wait")) {

      this.timeout = setTimeout( () => {
         this.timeout = null;
         this.runTestEvent();
      }, this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].wait * 1000);
   }
   else {
      this.runTestEvent();
   }
};

Tester.prototype.initiateNextTestEvent = function() {
   console.log("initiateNextTestEvent(): called - tc="+this.currentTestCase+" te="+this.currentTestEvent);

   if (this.currentTestEvent < this.testCases[this.currentTestCase].driveSequence.length - 1) {
      ++this.currentTestEvent;
      this.initiateTestEvent();
   }
};

Tester.prototype.runTestEvent = function() {
   console.log("runTestEvent(): called - tc="+this.currentTestCase+" te="+this.currentTestEvent);
   var tc = this.currentTestCase;
   var target = this;

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("target")) {
      target = this.gang.findSource(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].target);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("event")) {
      target.raiseEvent(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].event);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("property")) {
      console.log(this.uName+": runTestEvent() ", this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent]);
      target.alignPropertyValue(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property, this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].value);
   }

   if (tc == this.currentTestCase) {
      this.initiateNextTestEvent();
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

               var newFuzzFactor = fuzzFactor - (i - this.expectedPosition);
               newFuzzFactor = (newFuzzFactor < 0) ? 0 : newFuzzFactor;
               this.testCases[this.currentTestCase].expectedSequence[i].fuzz = newFuzzFactor;
            }
            break;
         }
      }

      if (result) {
         console.info(this.uName + ": TC"+ (this.currentTestCase + 1) + " EVENT " + (this.expectedPosition + 1) +
                      " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED");
      }
      else {
         console.error(this.uName + ": TC"+ (this.currentTestCase + 1) + " EVENT " + (this.expectedPosition + 1) +
                       " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {

         if ((this.timeout) || (this.currentTestEvent < this.testCases[this.currentTestCase].driveSequence.length - 1)) {
            console.info(this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " FAILED as all expected events have occurred but drive sequence not complete");
            process.exit(5);
         }

         console.info(this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " PASSED");

         if (++this.currentTestCase < this.testCases.length) {
            this.currentTestEvent = 0;
            this.expectedPosition = 0;
            this.initiateTestEvent();
         }
         else {
            console.info(this.uName + ": ALL TEST CASES (" + this.testCases.length + ") PASSED");
            process.exit(0);
         }
      }
   }
};

module.exports = exports = Tester;
