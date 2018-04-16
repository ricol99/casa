var util = require('util');
var Thing = require('../thing');
var SourceListener = require('../sourcelistener');

function TestSequence(_config) {
   Thing.call(this, _config);
   this.thingType = "testsequence";

   this.sequence = _config.sequence;
   this.currentPosition = 0;

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

}

util.inherits(TestSequence, Thing);

TestSequence.prototype.sourceIsInvalid = function(_data) {
   console.error(this.uName + ': TEST FAILED - Source invalid');
   process.exit(5);
};

TestSequence.prototype.sourceIsValid = function(_data) {
}

TestSequence.prototype.receivedEventFromSource = function(_data) {

   if (!_data.coldStart) {

      if ((_data.sourceName === this.sequence[this.currentPosition].source) &&
          (_data.name === this.sequence[this.currentPosition].property) &&
          (_data.value === this.sequence[this.currentPosition].value)) {

         console.info(this.uName + ": STEP " + (this.currentPosition + 1) + " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - PASSED");
      }
      else {
         console.error(this.uName + ": STEP " + (this.currentPosition + 1) + " - source=" + _data.sourceName + " property=" + _data.name + " value=" + _data.value + " - FAILED");
         process.exit(5);
      }

      if (++this.currentPosition === this.sequence.length) {
         console.info(this.uName + ": TEST PASSED");
         process.exit(0);
      }
   }
};

module.exports = exports = TestSequence;
