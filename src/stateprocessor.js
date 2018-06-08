var Gang = require('./gang');

function StateProcessor(_stateProperty) {
   this.stateProperty = _stateProperty;

   this.gang = Gang.mainInstance();
   this.casa = this.gang.casa;
}

StateProcessor.prototype.coldStart = function() {
};

module.exports = exports = StateProcessor;
