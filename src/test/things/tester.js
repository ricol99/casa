var util = require('../../util');
var Thing = require('../../thing');
var SourceListener = require('../../sourcelistener');

function Tester(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "testsequence";
   this.settleTime = _config.hasOwnProperty("settleTime") ? _config.settleTime : 3;
   this.targetUnderTest = (_config.hasOwnProperty("targetUnderTest")) ? this.gang.uNameToLongForm(_config.targetUnderTest) : this.uName;
   this.lastLogTime = Date.now()-1000;

   this.currentTestCase = 0;
   this.currentTestEvent = 0;

   this.expectedPosition = 0;
   this.testRunStarted = false;

   this.sourceListeners = {};

   this.generatingExpectedOutput = _config.hasOwnProperty("generateExpectedOutput");

   if (this.generatingExpectedOutput) {
      _config.testRun.testCases = [ _config.generateExpectedOutput ];
      this.preString = "";
   }

   if (_config.hasOwnProperty('source')) {
      _config.sources = [_config.source];
   }

   if (_config.hasOwnProperty('sources')) {

      for (var index = 0; index < _config.sources.length; ++index) {

         if (!_config.sources[index].hasOwnProperty("uName")) {
            _config.sources[index].uName = this.targetUnderTest;
         }

         _config.sources[index].listeningSource = this.uName;
         var sourceListener = new SourceListener(_config.sources[index], this);
         this.sourceListeners[sourceListener.sourceEventName] = sourceListener;
      }

      if (this.gang.casa) {
         this.gang.casa.scheduleRefreshSourceListeners();
      }

      this.delayStart = _config.testRun.hasOwnProperty("delayStart") ? _config.testRun.delayStart * 1000 : (this.gang.loader.connectToPeers ? 25000 : 0);
   }

   this.buildTestCases(util.copy(_config.testRun, true), util.copy(_config.testCases, true));
}

util.inherits(Tester, Thing);

// Called when system state is required
Tester.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
   _exportObj.currentTestCase = this.currentTestCase;
   _exportObj.currentTestEvent = this.currentTestEvent;
   _exportObj.expectedPosition = this.expectedPosition;
   _exportObj.timeout = this.timeout ? this.timeout.left() : -1;

   _exportObj.currentExpectedSequenceFuss = [];

   for (var j = 0; j < this.testCases[this.currentTestCase].expectedSequence.length; ++j) {

      if (this.testCases[this.currentTestCase].expectedSequence[j].hasOwnProperty("fuzz")) {
        _exportObj.currentExpectedSequenceFuss.push(this.testCases[this.currentTestCase].expectedSequence[j].fuzz);
      }
      else {
        _exportObj.currentExpectedSequenceFuss.push(-1);
      }
   }
};

// Called before hotStart to restore system state
Tester.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
   this.currentTestCase = _importObj.currentTestCase;
   this.currentTestEvent = _importObj.currentTestEvent;
   this.expectedPosition = _importObj.expectedPosition;
   this.timeout = (_importObj.timeout === -1) ? null : _importObj.timeout;

   for (var j = 0; j < _importObj.currentExpectedSequenceFuss.length; ++j) {
      
      if (_importObj.currentExpectedSequenceFuss[j] !== -1) {
        this.testCases[this.currentTestCase].expectedSequence[j].fuzz = _importObj.currentExpectedSequenceFuss[j];
      }
   }
};

Tester.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
   this.initiateTestEvent(false, this.timeout);
};

Tester.prototype.coldStart = function() {
   Thing.prototype.coldStart.call(this);

   util.setTimeout( () => {
      this.testRunStarted = true;
      this.initiateTestEvent();
   }, this.delayStart);
};

Tester.prototype.findTestCaseStep = function(_name, _type) {

   if (this.config.hasOwnProperty(_type)) {

      for (var i = 0; i < this.config[_type].length; ++i) {

         if (this.config[_type][i].name === _name) {
            return util.copy(this.config[_type][i], true);
         }
      }
   }

   process.stdout.write("\x1b[31m" + _type + " " + _name + " not found! Exiting.\x1b[0m\n");
   //console.log("\x1b[31m" + _type + " " + _name + " not found! Exiting.\x1b[0m");
   process.exit(2);
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
         var waitTime = _testCaseStep.driveSequence[i].wait;
         ret = true;
         this.replaceInnerTestCases(innerTestCaseStep, _testCaseStep.driveSequence[i].wait);
         _testCaseStep.driveSequence.splice(i, 1, ...innerTestCaseStep.driveSequence);

         if (waitTime) {
            _testCaseStep.driveSequence[i].wait = waitTime;
         }

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

Tester.prototype.initiateTestEvent = function(_cold, _restoreTimeout) {

   if (_restoreTimeout) {

      this.timeout = util.setTimeout( () => {
         this.timeout = null;
         this.runTestEvent();
      }, _restoreTimeout);
   }
   else if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("wait")) {

      this.timeout = util.setTimeout( () => {
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

   if ((this.currentTestEvent === 0) && (!this.generatingExpectedOutput)) {
      process.stdout.write("========= TEST CASE "+(this.currentTestCase + 1)+" =========\n");
      //console.info(this.uName + ": ========= TEST CASE "+(this.currentTestCase + 1)+" =========");
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("target")) {
      target = this.gang.findNamedObject(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].target);

      if (!target) {
         console.error("BROKEN! Target="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].target);
         process.exit(1);
      }
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("event")) {

      if (!this.generatingExpectedOutput) {
         process.stdout.write("TC"+(this.currentTestCase+1)+" >>>>>>>>>>>>>> SENDING EVENT >>>>>>>>>>>>> event="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].event+"\n");
      }
      target.newTransaction();
      target.raiseEvent(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].event);
   }

   if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("property")) {

      if (!this.generatingExpectedOutput) {

         if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("value")) {
             process.stdout.write("TC"+(this.currentTestCase+1)+" SETTING PROPERTY prop="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property +
                                  " value="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].value+"\n");
         }
         else {
             process.stdout.write("TC"+(this.currentTestCase+1)+" SETTING PROPERTY prop="+this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property +
                                  " ramp="+JSON.stringify(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].ramp)+"\n");
         }
      }

      target.newTransaction();

      if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("value")) {
         target.alignPropertyValue(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property, this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].value);
      }
      else if (this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].hasOwnProperty("ramp")) {
         target.alignPropertyRamp(this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].property, this.testCases[this.currentTestCase].driveSequence[this.currentTestEvent].ramp);
      }
   }

   if (tc == this.currentTestCase) {
      this.initiateNextTestEvent();
   }
};

Tester.prototype.sourceIsInvalid = function(_data) {

   if (this.testRunStarted) {
      console.error(this.uName + ': TEST FAILED - Source invalid');
      process.exit(5);
   }
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

Tester.prototype.generateExpectedOutput = function(_data) {

   this.logTime = Date.now();
   var propOrEvent = _data.propertyChange ? "\"property\"" : "\"event\"";

   if (_data && _data.transaction != this.lastTransaction) {
   //if ((this.logTime - this.lastLogTime) > 80 ) {

      if (this.delayedLog) {
         process.stdout.write(this.preString+"\n   "+this.delayedLog);
         this.preString = ",";
         this.delayedLog = null;
      }
 
      if (this.loggingSimultaneous) {
         this.loggingSimultaneous = false;
         process.stdout.write("\n      ]\n   }");
      }

      if (_data.transaction) {
         this.delayedLog = "{ \"source\": \""+_data.sourceName+"\", " + propOrEvent + ": \""+_data.name+"\", \"value\": "+util.stringForType(_data.value)+" }";
      }
   }
   else if (_data) {

      if (this.loggingSimultaneous) {
         process.stdout.write(this.preString+"\n         { \"source\": \""+_data.sourceName+"\", " + propOrEvent + ": \""+_data.name+"\", \"value\": "+util.stringForType(_data.value)+" }");
      }
      else {
         this.loggingSimultaneous = true;
         process.stdout.write(this.preString+"\n   {\n      \"simultaneous\": [");
         this.preString = "";

         if (this.delayedLog) {
            process.stdout.write(this.preString+"\n         "+this.delayedLog);
            this.delayedLog = null;
            this.preString = ",";
         }

         process.stdout.write(this.preString+"\n         { \"source\": \""+_data.sourceName+"\", " + propOrEvent + ": \""+_data.name+"\", \"value\": "+util.stringForType(_data.value)+" }");
         this.preString = ",";
      }
   }

   this.lastLogTime = this.logTime;
   this.lastTransaction = _data.transaction;
};

Tester.prototype.receivedEventFromSource = function(_data) {

   if (!_data.coldStart && this.testRunStarted) {

      if (this.generatingExpectedOutput) {

         if (this.generatingTimeout) {
            clearTimeout(this.generatingTimeout);
         }

         this.generatingTimeout = setTimeout( () => {
             this.generateExpectedOutput({ transaction: null });
             process.stdout.write("\n");
             process.exit(0);
         }, 15000);

         this.generateExpectedOutput(_data);
         return;
      }

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
         process.stdout.write("\x1b[32m"+"TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) + " - trans=" + _data.transaction +
                              " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED\x1b[0m\n");
         //console.info("\x1b[32m"+this.uName + ": TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) +
                      //" - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED\x1b[0m");
      }
      else {
         process.stdout.write("\x1b[31m"+"TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) +
                              " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED\x1b[0m\n");
         //console.info("\x1b[31m"+this.uName + ": TC"+ (this.currentTestCase + 1) + " RECEIVED EVENT " + (this.expectedPosition + 1) +
                       //" - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED\x1b[0m");
         process.exit(5);
      }

      if (++this.expectedPosition === this.testCases[this.currentTestCase].expectedSequence.length) {

         if ((this.timeout) || (this.currentTestEvent < this.testCases[this.currentTestCase].driveSequence.length - 1)) {
            process.stdout.write("\x1b[31m"+"TEST CASE " + (this.currentTestCase + 1) + " FAILED as all expected events have occurred but drive sequence not complete\x1b[0m\n");
            //console.info("\x1b[31m"+this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " FAILED as all expected events have occurred but drive sequence not complete\x1b[0m");
            process.exit(5);
         }

         process.stdout.write("\x1b[32m"+"TEST CASE " + (this.currentTestCase + 1) + " PASSED\x1b[0m\n");
         //console.info("\x1b[32m"+this.uName + ": TEST CASE " + (this.currentTestCase + 1) + " PASSED\x1b[0m");

         if (++this.currentTestCase < this.testCases.length) {
            this.currentTestEvent = 0;
            this.expectedPosition = 0;
            this.initiateTestEvent();
         }
         else {
            process.stdout.write("\x1b[32m"+"ALL TEST CASES (" + this.testCases.length + ") PASSED\x1b[0m\n");
            //console.info("\x1b[32m"+this.uName + ": ALL TEST CASES (" + this.testCases.length + ") PASSED\x1b[0m");

            setTimeout( () => {
               process.exit(0);
            }, 2000);
         }
      }
   }
};

module.exports = exports = Tester;
