var util = require('util');
var limb = require('limb');
var State = require('./state');

function ParentState(_name, _parent) {
   this.parentAddress = _parent.getHostname();
   this.parentPort = _parent.getPort();

   this.active = false;
   this.coldStart = true;

   State.call(this, 'parent:' + _name, _parent);

   var that = this;

   limb.info = {
      name: "dumgoyne-alarm"
   }

   var connectToParent = function() {
      console.log(that.name + ': Attempting to connect to parent ' + that.parentAddress + ':' + that.parentPort);
      limb.connect(that.parentPort, that.parentHost, function(crap) {
         if (crap == 0) {
            that.active = true;
            that.coldStart = false;
            that.emit('active', that.name);
            console.log(that.name + ': Connected to parent. ParentState going active.');
         }
         else {
            if (that.active || that.coldStart) {
               that.coldStart = false;
               that.active = false;
               that.emit('inactive', that.name);
               console.log(that.name + ': Lost connection to parent. ParentState going inactive.');
            }
            setTimeout(connectToParent, 10*1000);
         }
      });
   };

   connectToParent();
}

util.inherits(ParentState, State);

module.exports = exports = ParentState;
 
