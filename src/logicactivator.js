var util = require('util');
var Source = require('./source');
var CasaSystem = require('./casasystem');

function LogicActivator(_config) {

   this.name = _config.name;
   this.allInputsRequiredForValidity = _config.hasOwnProperty('allInputsRequiredForValidity') ? _config.allInputsRequiredForValidity : true;
   console.log(this.name + ': All inputs for validity = ' + this.allInputsRequiredForValidity);

   this.casaSys = CasaSystem.mainInstance();
   this.casa = this.casaSys.casa;

   this.sourceType = "activator";

   Source.call(this, _config);

   this.inputs = [];
   this.inputNames = [];

   this.casa.addActivator(this);

   this.active = false;

   var that = this;

   _config.sources.forEach(function(_sourceName, _index) {
      that.inputNames.push(_sourceName);
   });

   this.establishListeners();
}

util.inherits(LogicActivator, Source);

LogicActivator.prototype.establishListeners = function() {
   var that = this;
   this.sourceEnabled = false;

   // Define listening callbacks
   this.activeCallback = function(_data) {
      that.oneSourceIsActive(_data);
   };

   this.inactiveCallback = function(_data) {
      that.oneSourceIsInactive(_data);
   };

   this.invalidCallback = function(_data) {
      var oldSourceEnabled = that.sourceEnabled;
      var input = that.inputs[_data.sourceName];

      if (input && input.source) {
         input.source.removeListener('active', that.activeCallback);
         input.source.removeListener('inactive', that.inactiveCallback);
         input.source.removeListener('invalid', that.invalidCallback);
         that.inputs[_data.sourceName] = {};

         if (that.allInputsRequiredForValidity) {
            that.sourceEnabled = false;
         }
      }

      // Has the enabled stated changed from true to false?
      if (oldSourceEnabled && !that.sourceEnabled) {
         // If so, tell the others guys that I am now invalid
         that.emit('invalid', { sourceName: that.name });
      }
   };


   // Remove old inputs
   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop) && this.inputs[prop].source) {

         this.inputs[prop].source.removeListener('active', this.activeCallback);
         this.inputs[prop].source.removeListener('inactive', this.inactiveCallback);
         this.inputs[prop].source.removeListener('invalid', this.invalidCallback);
         this.inputs[prop] = {};
      }
   }


   // Attach sources again, perform the refresh
   var len = this.inputNames.length;
   var allInputsValid = true;

   for (var i = 0; i < len; ++i) {
      var source = this.casaSys.findSource(this.inputNames[i]);

      if (source) {
        if (source.sourceEnabled) {
           that.inputs[source.name] = { source: source, active: false, priority: i };
        }
        else {
           allInputsValid = false;
        }
      }
   }

   if (this.allInputsRequiredForValidity && !allInputsValid) {
      // Not valid so remove inputs 
      for(var prop in this.inputs) {

         if(this.inputs.hasOwnProperty(prop)){
            this.inputs[prop] = {};
         }
      }
   }
   else {
      for(var prop in this.inputs) {

         if(this.inputs.hasOwnProperty(prop)){
            this.inputs[prop].source.on('active', this.activeCallback);
            this.inputs[prop].source.on('inactive', this.inactiveCallback);
            this.inputs[prop].source.on('invalid', this.invalidCallback);
         }
      }

      this.sourceEnabled = true;
   }

   return this.sourceEnabled;
}

LogicActivator.prototype.refreshSources = function() {
   var ret = true;
   if (!this.sourceEnabled || !this.allInputsRequiredForValidity) {
      ret = this.establishListeners();
      console.log(this.name + ': Refreshed action. result=' + ret);
   }
   return ret;
}

LogicActivator.prototype.oneSourceIsActive = function(_data) {
   console.log(this.name + ': Input source ' + _data.sourceName + ' active!');

   if (_data.sourceName && this.inputs[_data.sourceName]) {
      this.inputs[_data.sourceName].active = true;
      this.inputs[_data.sourceName].activeData = _data;
      this.emitIfNecessary(this.inputs[_data.sourceName]);
   }
}

LogicActivator.prototype.oneSourceIsInactive = function(_data) {
   console.log(this.name + ' : Input source ' + _data.sourceName + ' inactive!');
         
   if (_data.sourceName && this.inputs[_data.sourceName]) {
      this.inputs[_data.sourceName].active = false;
      this.inputs[_data.sourceName].inactiveData = _data;
      this.emitIfNecessary(this.inputs[_data.sourceName]);
   }
}

LogicActivator.prototype.findHighestPriorityInput = function(_outputActive) {
   var highestPriorityFound = 99999;
   var highestPriorityInput = null;


   for(var prop in this.inputs) {

      if(this.inputs.hasOwnProperty(prop)){
         var input = this.inputs[prop];

         if (input.priority < highestPriorityFound && input.active == _outputActive) {
            highestPriorityFound = input.priority;
            highestPriorityInput = input;
         }
      }
   }

   return highestPriorityInput;
}

LogicActivator.prototype.emitIfNecessary = function(_input) {
   var outputShouldGoActive = this.checkActivate();
   var highestPriorityInput = this.findHighestPriorityInput(outputShouldGoActive);

   if (!highestPriorityInput) {
      //highestPriorityInput = { source: _input, activeData: { sourceName: _input.name }, inactiveData: { sourceName: _input.name }, priority: 0 };
      highestPriorityInput = _input;
   }

   if (this.active) {

      if (outputShouldGoActive) {
         // Already active so check priority
         if (highestPriorityInput.priority > _input.priority) {
            this.goActive(highestPriorityInput.activeData);
         }
      }
      else {
         this.goInactive(highestPriorityInput.inactiveData);
      }
   }
   else {
      if (!outputShouldGoActive) {
         // Already inactive so check priority
         if (highestPriorityInput.priority > _input.priority) {
            this.goInactive(highestPriorityInput.inactiveData);
         }
      }
      else {
         this.goActive(highestPriorityInput.activeData);
      }
   }
}

module.exports = exports = LogicActivator;
