var util = require('../util');
var StateProperty = require('./stateproperty');

function ModeProperty(_config, _owner) {
   var modeConfig = util.copy(_config);
   modeConfig.writable = false;

   modeConfig.initialValue = _config.hasOwnProperty("initialValue") ? _config.initialValue : _config.restingMode.name;
   modeConfig.ignoreParent = _config.hasOwnProperty("ignoreParent") ? _config.ignoreParent : false;
   modeConfig.ignoreChildren = _config.hasOwnProperty("ignoreChildren") ? _config.ignoreChildren : false;
   modeConfig.propagateToParent = _config.hasOwnProperty("propagateToParent") ? _config.propagateToParent : true;
   modeConfig.propagateToChildren = _config.hasOwnProperty("propagateToChildren") ? _config.propagateToChildren : true;
   modeConfig.globalPriority = _config.hasOwnProperty("globalPriority") ? _config.globalPriority : true;

   let modeName = _config.hasOwnProperty("modeName") ? _config.modeName : "MODE";
   let activesPositiveCountPropName = _config.name.toUpperCase() + "-ACTIVES-POSITIVE-COUNT";
   let activesValidPropName = _config.name.toUpperCase() + "-ACTIVES-VALID";

   modeConfig.takeControlOnTransition = true;
   modeConfig.ignoreControl = true;

   modeConfig.states = [ _config.restingMode ];

   if (modeConfig.states[0].hasOwnProperty("action")) {
      modeConfig.states[0].actions = [ util.copy(modeConfig.states[0].action) ];
   }
   else if (!modeConfig.states[0].hasOwnProperty("actions")) {
      modeConfig.states[0].actions = [];
   }

   var durationPropName = _config.restingMode.name.toUpperCase()+"-" + modeName + "-DURATION";
   modeConfig.states[0].actions.push({ property: durationPropName, value: -1 });

   if (modeConfig.states[0].hasOwnProperty("source")) {
      modeConfig.states[0].sources = [ util.copy(modeConfig.states[0].source) ];
   }
   else if (!modeConfig.states[0].hasOwnProperty("sources")) {
      modeConfig.states[0].sources = [];
   }

   modeConfig.states[0].sources.push({ property: activesValidPropName, value: false, nextState: "invalid" });

   if (_config.hasOwnProperty("modes") && _config.modes) {

      for (var i = 0; i < _config.modes.length; ++i) {
         let mode = _config.modes[i];
         modeConfig.states.push({ name: mode.name, priority: mode.hasOwnProperty("priority") ? mode.priority : 100, sources: [] });
         durationPropName = mode.name.toUpperCase()+"-" + modeName + "-DURATION";
         var activePropName = mode.name.toUpperCase()+"-" + modeName + "-ACTIVE";

         modeConfig.states[modeConfig.states.length - 1].sources.push({ property: activePropName, value: false, nextState: "settle-invalid" });

         for (var j = 0; j < _config.modes.length; ++j) {

            if (i !== j) {
               modeConfig.states[modeConfig.states.length - 1].sources.push({ property: _config.modes[j].name.toUpperCase()+"-" + modeName + "-ACTIVE", value: true,
                                                                              action: { property: activePropName, value: false }, nextState: "settle-invalid" });
            }
         }

         modeConfig.states[0].sources.push({ property: activePropName, value: true, nextState: _config.modes[i].name });
         modeConfig.states[modeConfig.states.length - 1].timeout = { source: { property: durationPropName },
                                                                     actions: [{ property: durationPropName, value: -1 },
                                                                               { property: activePropName, value: false }],
                                                                     nextState: "settle-invalid" };

         if (mode.hasOwnProperty("action")) {
            modeConfig.states[modeConfig.states.length - 1].actions = [ mode.action ];
         }

         if (mode.hasOwnProperty("actions")) {
            modeConfig.states[modeConfig.states.length - 1].actions = mode.actions;
         }
      }
   }

   modeConfig.states.push({ name: "settle-invalid", timeout: { duration: 0.1, nextState: "invalid" } });
   modeConfig.states.push({ name: "invalid", sources: [{ property: activesValidPropName, value: true, nextState: _config.restingMode.name }] });

   StateProperty.call(this, modeConfig, _owner);

   if (_config.hasOwnProperty("modes") && _config.modes) {
      var counterConfig = { name: activesPositiveCountPropName, type: "counterproperty", local: true, initialValue: 0, countPositives: true, sources: []};

      for (var z = 0; z < _config.modes.length; ++z) {
         let mode = _config.modes[z];
         let timeout = mode.hasOwnProperty("timeout") ? mode.timeout : -1;
         durationPropName = mode.name.toUpperCase()+"-" + modeName + "-DURATION";
         activePropName = mode.name.toUpperCase()+"-" + modeName + "-ACTIVE";
         counterConfig.sources.push({ property: activePropName });

         this.createProperty({ name: durationPropName, type: "property", valueType: "number", ignoreParent: modeConfig.ignoreParent, ignoreChildren: modeConfig.ignoreChildren,
                               propagateToParent: modeConfig.propagateToParent, propagateToChildren: modeConfig.propagateToChildren, initialValue: timeout }, _config);

         let activeSources = [{ property: this.name, value: mode.name, transform: "true", valueType: "boolean" }];

         if (mode.hasOwnProperty("triggerOnDurationChange") && mode.triggerOnDurationChange) {
            activeSources.push({ property: durationPropName, transform: "$value !== -1", valueType: "boolean" });
         }

         this.createProperty({ name: activePropName, type: "property", valueType: "boolean", initialValue: modeConfig.initialValue === mode.name,
                               sources: activeSources}, _config);

      }

      this.createProperty(counterConfig, _config);
      this.createProperty({ name: activesValidPropName, type: "evalproperty", valueType: "boolean", local: true, initialValue: true,
                            sources: [{ property: activesPositiveCountPropName }], expression: "$values[0] < 2" }, _config);
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
