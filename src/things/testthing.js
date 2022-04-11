var util = require('../util');
var Thing = require('../thing');

function TestThing(_config, _parent) {

   Thing.call(this, _config, _parent);
   this.thingType = "test";
}

util.inherits(TestThing, Thing);

// Called when current state required
TestThing.prototype.export = function(_exportObj) {
   Thing.prototype.export.call(this, _exportObj);
};

// Called when current state required
TestThing.prototype.import = function(_importObj) {
   Thing.prototype.import.call(this, _importObj);
};

TestThing.prototype.coldStart = function() { 
   Thing.prototype.coldStart.call(this);
};

TestThing.prototype.hotStart = function() {
   Thing.prototype.hotStart.call(this);
};

TestThing.prototype.testActionFunction = function(_state) {
   console.log("TestState1Processor: testActionFunction() called from _state "+_state.name);
   this.alignProperties([{ property: "test-prop-3", value: true }]);
   this.raiseEvent("test-action-function-event");
};

module.exports = exports = TestThing;
