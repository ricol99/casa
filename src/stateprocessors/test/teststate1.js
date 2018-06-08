var StateProcessor = require('../../stateprocessor');

function TestState1Processor(_stateProperty) {
   StateProcessor.call(this, _stateProperty);

}

TestState1Processor.prototype.coldStart = function(_data) {
};

TestState1Processor.prototype.testTargetFunction = function(_state) {
   console.log("TestState1Processor: testTargetFunction() called from _state "+_state.name);
   this.stateProperty.alignProperties([{ property: "test-prop-3", value: true }]);
   this.stateProperty.raiseEvent("test-target-function-event");
};

module.exports = exports = TestState1Processor;
