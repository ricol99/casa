var util = require('../util');
var Thing = require('../thing');

function TestThing(_config) {

   Thing.call(this, _config);
   this.thingType = "test";
}

util.inherits(TestThing, Thing);

TestThing.prototype.testActionFunction = function(_state) {
   console.log("TestState1Processor: testActionFunction() called from _state "+_state.name);
   this.alignProperties([{ property: "test-prop-3", value: true }]);
   this.raiseEvent("test-action-function-event");
};

module.exports = exports = TestThing;
