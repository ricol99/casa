var SourceBaseConsoleCmd = require('./sourcebaseconsolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function SourceConsoleCmd(_config, _owner, _console) {
   SourceBaseConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(SourceConsoleCmd, SourceBaseConsoleCmd);

SourceConsoleCmd.prototype.set = function(_arguments, _callback) {
   this.checkArguments(2, _arguments);
   this.executeParsedCommand("setProperty", _arguments, _callback);
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
