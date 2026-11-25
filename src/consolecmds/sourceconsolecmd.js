var SourceBaseConsoleCmd = require('./sourcebaseconsolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function SourceConsoleCmd(_config, _owner, _console) {
   SourceBaseConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(SourceConsoleCmd, SourceBaseConsoleCmd);

// Called when current state required
SourceConsoleCmd.prototype.export = function(_exportObj) {
   SourceBaseConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
SourceConsoleCmd.prototype.import = function(_importObj) {
   SourceBaseConsoleCmd.prototype.import.call(this, _importObj);
};

SourceConsoleCmd.prototype.coldStart = function() {
   SourceBaseConsoleCmd.prototype.coldStart.call(this);
};

SourceConsoleCmd.prototype.hotStart = function() {
   SourceBaseConsoleCmd.prototype.hotStart.call(this);
};

SourceConsoleCmd.prototype.set = function(_arguments, _callback) {
   this.checkArguments(2, _arguments);
   this.executeParsedCommand("setProperty", _arguments, _callback);
};

SourceConsoleCmd.prototype.setManualMode = function(_arguments, _callback) {
   return this.executeManualCommand("setManualMode", _arguments, 0, 1, _callback);
};

SourceConsoleCmd.prototype.renewManualOverride = function(_arguments, _callback) {
   return this.executeManualCommand("renewManualOverride", _arguments, 1, 1, _callback);
};

SourceConsoleCmd.prototype.releaseManualOverride = function(_arguments, _callback) {
   return this.executeManualCommand("releaseManualOverride", _arguments, 0, 0, _callback);
};

SourceConsoleCmd.prototype.executeManualCommand = function(_command, _arguments, _min, _max, _callback) {
   var args = _arguments || [];
   var usage = "Usage: " + _command + (_max ? (_min ? " <seconds>" : " [seconds]") : "");
   if (args.length === 1 && (args[0] === "--help" || args[0] === "--usage")) {
      this.console.write(usage);
      return _callback(null, true);
   }
   if (args.length < _min || args.length > _max) return _callback(usage);
   var params = [];
   if (args.length) {
      var duration = (typeof args[0] === "string" || typeof args[0] === "number") ? Number(args[0]) : NaN;
      if (!Number.isFinite(duration) || duration <= 0) return _callback("Duration must be positive finite seconds. " + usage);
      params.push(duration);
   }
   return this.executeParsedCommand(_command, params, _callback);
};

SourceConsoleCmd.prototype.events = function(_arguments, _callback) {

   if (_arguments && (_arguments.length > 0)) {
      let mainDefinitions = [ { name: 'command', defaultOption: true },
                              { name: 'usage', type: Boolean },
                              { name: 'help', type: Boolean } ];

      const mainCommand = commandLineArgs(mainDefinitions, { argv: _arguments, stopAtFirstUnknown: true });

      if (mainCommand.usage || mainCommand.help) {
         this.console.write("Usage: events [--usage | --help]");
         this.console.write("              <mainCommand> [ --help | <mainCommandOptions> ]");
         this.console.write("              <mainCommand> :== show | raise | create | delete | update\n");
         return _callback(null, true);
      }

      let argv = mainCommand._unknown || [];

      if (mainCommand.command === "show") {
         this.executeParsedCommand("events", _arguments, _callback);
      }
      else if (mainCommand.command === "create") {

         if (argv.length === 0) {
            return _callback("Nothing to create!");
         }

         const createEventDefinitions = [ { name: 'name', alias: 'n', type: String },
                                          { name: 'persist', alias: 'p', type: Boolean },
                                          { name: 'rules', multiple: true, type: String, defaultOption: true } ];

         const createEventOptions = commandLineArgs(createEventDefinitions, { argv: argv });

         const persist = createEventOptions.hasOwnProperty("persist") ? createEventOptions.persist : false;

         if (!createEventOptions.hasOwnProperty("rules") || (createEventOptions.rules.length === 0)) {
            return _callback("events: New event must have at least one rule!");
         }

         if (!createEventOptions.hasOwnProperty("name") || !createEventOptions.name) {
            return _callback("events: New event must have a name (use --name <name>)!");
         }

         this.console.correctArgumentTypes(createEventOptions.rules);
         return this.executeParsedCommand("addScheduledEvent", [ createEventOptions.name, createEventOptions.rules, persist ], _callback);
      }
      else if (mainCommand.command === "raise") {

         if (argv.length === 0) {
            return _callback("Nothing to raise!");
         }

         const raiseEventDefinitions = [ { name: 'name', alias: 'n', type: String },
                                         { name: 'value', type: String, defaultOption: true } ];

         const raiseEventOptions = commandLineArgs(raiseEventDefinitions, { argv: argv });

         if (!raiseEventOptions.hasOwnProperty("name") || !raiseEventOptions.name) {
            return _callback("events: Event must have a name (use --name <name>)!");
         }

         let value = raiseEventOptions.hasOwnProperty("value") ? raiseEventOptions.value : false;
         var params = [ raiseEventOptions.name, value ];
         this.console.correctArgumentTypes(params);
         return this.executeParsedCommand("raiseEvent", params, _callback);
      }
      else if (mainCommand.command === "delete") {

         if (argv.length === 0) {
            return _callback("Nothing to delete!");
         }

         const deleteEventDefinitions = [ { name: 'name', alias: 'n', type: String, defaultOption: true },
                                          { name: 'persist', alias: 'p', type: Boolean } ];

         const deleteEventOptions = commandLineArgs(deleteEventDefinitions, { argv: argv });

         const persist = deleteEventOptions.hasOwnProperty("persist") ? deleteEventOptions.persist : false;

         if (!deleteEventOptions.hasOwnProperty("name") || !deleteEventOptions.name) {
            return _callback("events: Must have a name to identify event to be deleted!");
         }

         return this.executeParsedCommand("removeScheduledEvent", [ deleteEventOptions.name, persist ], _callback);
      }
      else if (mainCommand.command === "update") {

         if (argv.length === 0) {
            return _callback("Nothing to update!");
         }

         const updateEventDefinitions = [ { name: 'name', alias: 'n', type: String },
                                          { name: 'persist', alias: 'p', type: Boolean },
                                          { name: 'rules', multiple: true, type: String, defaultOption: true } ];

         const updateEventOptions = commandLineArgs(updateEventDefinitions, { argv: argv });

         const persist = updateEventOptions.hasOwnProperty("persist") ? updateEventOptions.persist : false;

         if (!updateEventOptions.hasOwnProperty("rules") || (updateEventOptions.rules.length === 0)) {
            return _callback("events: New event must have at least one rule!");
         }

         if (!updateEventOptions.hasOwnProperty("name") || !updateEventOptions.name) {
            return _callback("events: Event name not specified (use --name <name>)!");
         }

         this.console.correctArgumentTypes(updateEventOptions.rules);
         return this.executeParsedCommand("updateScheduledEvent", [ updateEventOptions.name, updateEventOptions.rules, persist ], _callback);
      }
   }
   else {
      return this.executeParsedCommand("events", _arguments, _callback);
   }
   return _callback("events: Main command not found!");
};

module.exports = exports = SourceConsoleCmd;
