var util = require('../util');
var StateProperty = require('./stateproperty');

function ModeProperty(_config, _owner) {
   var modeConfig = util.copy(_config);

   modeConfig.initialValue = _config.hasOwnProperty("initialValue") ? _config.initialValue : _config.restingMode.name;
   modeConfig.ignoreParent = _config.hasOwnProperty("ignoreParent") ? _config.ignoreParent : false;
   modeConfig.ignoreChildren = _config.hasOwnProperty("ignoreChildren") ? _config.ignoreChildren : false;
   modeConfig.propagateToParent = _config.hasOwnProperty("propagateToParent") ? _config.propagateToParent : true;
   modeConfig.propagateToChildren = _config.hasOwnProperty("propagateToChildren") ? _config.propagateToChildren : true;
   modeConfig.globalPriority = _config.hasOwnProperty("globalPriority") ? _config.globalPriority : true;

   modeConfig.takeControlOnTransition = true;
   modeConfig.ignoreControl = true;

   modeConfig.states = [ _config.restingMode ];

   if (modeConfig.states[0].hasOwnProperty("action")) {
      modeConfig.states[0].actions = [ util.copy(modeConfig.states[0].action) ];
   }
   else if (!modeConfig.states[0].hasOwnProperty("actions")) {
      modeConfig.states[0].actions = [];
   }

   var durationPropName = _config.restingMode.name.toUpperCase()+"-MODE-DURATION";
   modeConfig.states[0].actions.push({ property: durationPropName, value: -1 });

   if (modeConfig.states[0].hasOwnProperty("source")) {
      modeConfig.states[0].sources = [ util.copy(modeConfig.states[0].source) ];
   }
   else if (!modeConfig.states[0].hasOwnProperty("sources")) {
      modeConfig.states[0].sources = [];
   }

   if (_config.hasOwnProperty("modes")) {

      for (var i = 0; i < _config.modes.length; ++i) {
         let mode = _config.modes[i];
         modeConfig.states.push({ name: mode.name, priority: mode.hasOwnProperty("priority") ? mode.priority : 100 });
         durationPropName = mode.name.toUpperCase()+"-MODE-DURATION";

         if (mode.hasOwnProperty("triggerOnDurationChange") && mode.triggerOnDurationChange) {
            modeConfig.states[0].sources.push({ property: durationPropName, guard: { property: durationPropName, value: -1, invert: true }, nextState: mode.name });
         }

         modeConfig.states[modeConfig.states.length - 1].timeout = { source: { property: durationPropName }, action: { property: durationPropName, value: -1 }, nextState: _config.restingMode.name };

         if (mode.hasOwnProperty("action")) {
            modeConfig.states[modeConfig.states.length - 1].actions = [ mode.action ];
         }

         if (mode.hasOwnProperty("actions")) {
            modeConfig.states[modeConfig.states.length - 1].actions = mode.actions;
         }
      }
   }

   StateProperty.call(this, modeConfig, _owner);

   if (_config.hasOwnProperty("modes")) {

      for (var i = 0; i < _config.modes.length; ++i) {
         let mode = _config.modes[i];
         let timeout = mode.hasOwnProperty("timeout") ? mode.timeout : -1;
         durationPropName = mode.name.toUpperCase()+"-MODE-DURATION";

         this.createProperty({ name: durationPropName, type: "property", ignoreParent: modeConfig.ignoreParent, ignoreChildren: modeConfig.ignoreChildren,
                               propagateToParent: modeConfig.propagateToParent, propagateToChildren: modeConfig.propagateToChildren, initialValue: timeout }, _config);
      }
   }
}

util.inherits(ModeProperty, StateProperty);

// Called when system state is required
ModeProperty.prototype.export = function(_exportObj) {
   StateProperty.prototype.export.call(this, _exportObj);
};

// Called to restore system state before hot start
ModeProperty.prototype.import = function(_importObj) {
   StateProperty.prototype.import.call(this, _importObj);
};

// Called after system state has been restored
ModeProperty.prototype.hotStart = function() {
   StateProperty.prototype.hotStart.call(this);
};

// Called to start a cold system
ModeProperty.prototype.coldStart = function () {
   StateProperty.prototype.coldStart.call(this);
};

module.exports = exports = ModeProperty;
