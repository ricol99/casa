var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function Tester(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "testsequence";
   this.config = _config;
   this.settleTime = _config.hasOwnProperty("settleTime") ? _config.settleTime : 3;
   this.targetUnderTest = (_config.hasOwnProperty("targetUnderTest")) ? this.gang.uNameToLongForm(_config.targetUnderTest) : this.uName;

   this.currentTestCase = 0;
   this.currentTestEvent = 0;

   this.expectedPosition = 0;

   this.sourceListeners = {};
   this.noOfSources = 0;

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {

      for (var index = 0; index < _config.sources.length; ++index) {

         if (!_config.sources[index].hasOwnProperty("uName")) {
            _config.sources[index].uName = this.targetUnderTest;
         }

         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
         this.noOfSources++;
      }
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
            return util.copy(this.config[_type][i], true);
         }
      }
   }
   return null;
};

Tester.prototype.addTargetUnderTest = function(_testCase) {

   for (var i = 0; i < _testCase.driveSequence.length; ++i) {

      if (!_testCase.driveSequence[i].hasOwnProperty("target")) {
         _testCase.driveSequence[i].target = this.targetUnderTest;
      }
   }

   for (var j = 0; j < _testCase.expectedSequence.length; ++j) {

      if (!_testCase.expectedSequence[j].hasOwnProperty("source")) {
         _testCase.expectedSequence[j].source = this.targetUnderTest;
      }
      else {
         _testCase.expectedSequence[j].source = this.gang.uNameToLongForm(_testCase.expectedSequence[j].source);
      }
   }
};

Tester.prototype.replaceInnerTestCases = function(_testCaseStep) {
   var ret = false;

   for (var i = 0; i < _testCaseStep.driveSequence.length; ++i) {

      let innerTestCaseStep = null;

      if (_testCaseStep.driveSequence[i].hasOwnProperty("testCase")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.driveSequence[i].testCase.name, "testCases");
      }
      else if (_testCaseStep.driveSequence[i].hasOwnProperty("testStep")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.driveSequence[i].testStep.name, "testSteps");
      }

      if (innerTestCaseStep) {
         ret = true;
         this.replaceInnerTestCases(innerTestCaseStep);
         _testCaseStep.driveSequence.splice(i, 1, ...innerTestCaseStep.driveSequence);
         i += innerTestCaseStep.driveSequence.length - 1;
      }
   }

   for (var j = 0; j < _testCaseStep.expectedSequence.length; ++j) {

      let innerTestCaseStep = null;

      if (_testCaseStep.expectedSequence[j].hasOwnProperty("testCase")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.expectedSequence[j].testCase.name, "testCases");
      }
      else if (_testCaseStep.expectedSequence[j].hasOwnProperty("testStep")) {
         innerTestCaseStep = this.findTestCaseStep(_testCaseStep.expectedSequence[j].testStep.name, "testSteps");
      }

      if (innerTestCaseStep) {
         ret = true;
         this.replaceInnerTestCases(innerTestCaseStep);
         _testCaseStep.expectedSequence.splice(j, 1, ...(innerTestCaseStep.expectedSequence));
         j += innerTestCaseStep.expectedSequence.length - 1;
      }
   }

   return ret;
};

Tester.prototype.buildTestCase = function(_testCase) {
   var innerCasesFound = true;

   while (innerCasesFound) {
      innerCasesFound = this.replaceInnerTestCases(_testCase);
   }

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
   this.addTargetUnderTest(this.testCases[this.testCases.length - 1]);
};

Tester.prototype.buildTestCases = function(_testRun, _testCases) {
   this.testCases = [];

   if (_testRun) {

      if ((!_testRun.hasOwnProperty("testCases")) || (_testRun.testCases.length === 0)) {
         _testRun.testCases = [];

         for (var k = 0; k < _testCases.length; ++k) {
            _testRun.testCases.push(k+1);
         }
      }

      if (_testRun.hasOwnProperty("preAmble")) {
         this.addPreAmble(_testRun.preAmble, _testCases[_testRun.testCases[0]-1]);
      }

      if (_testRun.hasOwnProperty("postAmble")) {
         this.addPostAmble(_testRun.postAmble, _testCases[_testRun.testCases[_testRun.testCases.length-1]-1]);
      }

      for (var i = 0; i < _testRun.testCases.length; ++i) {
         this.buildTestCase(_testCases[_testRun.testCases[i]-1]);
      }

   }
   else {
      for (var j = 0; j < _testCases.length; ++j) {
         this.buildTestCase(_testCases[j]);
      }
   }
};

Tester.prototype.addPostAmble = function(_postAmble, _testCase) {

    if (_postAmble.hasOwnProperty("driveSequence")) {

       if (_testCase.hasOwnProperty("driveSequence")) {
          _testCase.driveSequence.push(..._postAmble.driveSequence);
       }
       else {
          _testCase.driveSequence = _postAmble.driveSequence;
       }
    }

    if (_postAmble.hasOwnProperty("expectedSequence")) {

       if (_testCase.hasOwnProperty("expectedSequence")) {
          _testCase.expectedSequence.push(..._postAmble.expectedSequence);
       }
       else {
          _testCase.expectedSequence = _postAmble.expectedSequence;
       }
    }
};

Tester.prototype.addPreAmble = function(_preAmble, _testCase) {

    if (_preAmble.hasOwnProperty("driveSequence")) {

       if (_testCase.hasOwnProperty("driveSequence")) {
          _testCase.driveSequence.unshift(..._preAmble.driveSequence);
       }
       else {
          _testCase.driveSequence = _preAmble.driveSequence;
       }
    }

    if (_preAmble.hasOwnProperty("expectedSequence")) {

       if (_testCase.hasOwnProperty("expectedSequence")) {
          _testCase.expectedSequence.unshift(..._preAmble.expectedSequence);
       }
       else {
          _testCase.expectedSequence = _preAmble.expectedSequence;
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

   console.log("initiateNextTestEvent(): called - tc="+(this.currentTestCase + 1)+" te="+this.currentTestEvent);

   if (this.currentTestEvent < this.testCases[this.currentTestCase].driveSequence.length - 1) {
      ++this.currentTestEvent;
      this.initiateTestEvent();
   }
};

Tester.prototype.runTestEvent = function() {
   console.log("runTestEvent(): called - tc="+(this.currentTestCase  + 1)+" te="+this.currentTestEvent);
   var tc = this.currentTestCase;
   var target = this;

   if (this.currentTestEvent === 0) {
      console.info(this.uName + ": ========= TEST CASE "+(this.currentTestCase + 1)+" =========");
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("target")) {
      target = this.gang.findNamedObject(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].target);
      if (!target) {
         console.log("AAAAAAA BROKEN! Target="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].target);
         process.exit(1);
      }
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("event")) {
      console.info(this.uName+": TC"+(this.currentTestCase+1)+" >>>>>>>>>>>>>> SENDING EVENT >>>>>>>>>>>>> event="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].event);
      target.raiseEvent(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].event);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("property")) {
      console.info(this.uName+": TC"+(this.currentTestCase+1)+" SETTING PROPERTY prop="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property + " value="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].value);
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
      //console.info(this.uName + ": AAAAAA " + this.testCases[this.currentTestCase].expectedSequence[_index].source + " " + name + " " + this.testCases[this.currentTestCase].expectedSequence[_index].value);
   }
   else {
      name = this.testCases[this.currentTestCase].expectedSequence[_index].event;
   }

   console.log(this.uName+": AAAA data.sourceName="+_data.sourceName+" test source="+this.testCases[this.currentTestCase].expectedSequence[_index].source);

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
               //console.info(this.uName + ": AAAAAA not in expected position!");
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
         //console.info(this.uName + ": AAAAAA result found!");
         console.info("\x1b[32m"+this.uName + ": TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) +
                      " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED\x1b[0m");
      }
      else {
         //console.info(this.uName + ": AAAAAA not result found!");
         console.info("\x1b[31m"+this.uName + ": TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) +
                       " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED\x1b[0m");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {

         if ((this.timeout) || (this.currentTestEvent < this.testCases[this.currentTestCase].driveSequence.length - 1)) {
            console.info("\x1b[31m"+this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " FAILED as all expected events have occurred but drive sequence not complete\x1b[0m");
            process.exit(5);
         }

         console.info("\x1b[32m"+this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " PASSED\x1b[0m");

         if (++this.currentTestCase < this.testCases.length) {
            this.currentTestEvent = 0;
            this.expectedPosition = 0;
            this.initiateTestEvent();
         }
         else {
            console.info("\x1b[32m"+this.uName + ": ALL TEST CASES (" + this.testCases.length + ") PASSED\x1b[0m");
            process.exit(0);
         }
      }
   }
};

module.exports = exports = Tester;
