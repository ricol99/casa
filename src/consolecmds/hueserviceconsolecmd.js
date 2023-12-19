var ConsoleCmd = require('../consolecmd');
var util = require('util');
var commandLineArgs = require('command-line-args');

function HueServiceConsoleCmd(_config, _owner, _console) {
   ConsoleCmd.call(this, _config, _owner, _console);
}

util.inherits(HueServiceConsoleCmd, ConsoleCmd);

// Called when current state required
HueServiceConsoleCmd.prototype.export = function(_exportObj) {
   ConsoleCmd.prototype.export.call(this, _exportObj);
};

// Called to restore current state
HueServiceConsoleCmd.prototype.import = function(_importObj) {
   ConsoleCmd.prototype.import.call(this, _importObj);
};

HueServiceConsoleCmd.prototype.coldStart = function() {
   ConsoleCmd.prototype.coldStart.call(this);
};

HueServiceConsoleCmd.prototype.hotStart = function() {
   ConsoleCmd.prototype.hotStart.call(this);
};

HueServiceConsoleCmd.prototype.findBridges = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.executeParsedCommand("findBridges", [], _callback);
};

HueServiceConsoleCmd.prototype.findBridge = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   this.console.write("Scanning for bridges, this will take 20 seconds...");

   this.executeParsedCommand("findBridge", _arguments, _callback);
};

HueServiceConsoleCmd.prototype.createUserOnBridge = function(_arguments, _callback) {
   this.checkArguments(0, _arguments);
   var persist = (_arguments.length > 0) ? _arguments[0] : false;

   this.findBridge([], (_err, _bridge) => {

      if (_err) {
         return _callback(_err);
      }

      this.console.write("Found bridge " + _bridge.id + " at IP address " + _bridge.ipaddress);

      this.console.question("Please press the top button on this bridge and confirm by pressing enter...", (_answer)  => {
         this.executeParsedCommand("createUserOnBridge", [ _bridge.ipaddress, persist ], _callback);
      });
   });
};

HueServiceConsoleCmd.prototype.lights = function(_arguments, _callback) {
   this.executeParsedCommand("lights", [], _callback);
};

HueServiceConsoleCmd.prototype.groups = function(_arguments, _callback) {

   if (_arguments && (_arguments.length > 0)) {

      var lightGroupDefinitions = [
         { name: 'groupId', alias: 'l', type: String, defaultOption: true },
         { name: 'create', alias: 'c', type: String }
      ];

      var options = commandLineArgs(lightGroupDefinitions, { argv: _arguments });
      return _callback(options);
   }
   else {
      this.executeParsedCommand("groups", _arguments, _callback);
   }
};

HueServiceConsoleCmd.prototype.hub = function(_arguments, _callback) {

   if (_arguments && (_arguments.length > 0)) {
      let mainDefinitions = [ { name: 'name', defaultOption: true },
                              { name: 'usage', type: Boolean },
                              { name: 'help', type: Boolean } ];

      const mainCommand = commandLineArgs(mainDefinitions, { argv: _arguments, stopAtFirstUnknown: true })

      if (mainCommand.usage || mainCommand.help) {
         this.console.write("Usage: events [--usage | --help]");
         this.console.write("              <mainCommand> [ --help | <mainCommandOptions> ] <subCommand> [ --help | <subCommandOptions> ]");
         this.console.write("              <mainCommand> :== show | create | delete | replace\n");
         return _callback(null, true);
      }

      let argv = mainCommand._unknown || [];

      if (mainCommand.name === "show") {
         var target = (argv.length > 0) ? argv[0] : "lights";

         switch (target) {
            case "lights":
               return this.executeParsedCommand("lights", [], _callback);
               break;
            case "groups":
               return this.executeParsedCommand("groups", _arguments, _callback);
               break;
            default:
               return _callback("Unrecognised target!");
         }
      }
      else if (mainCommand.name === "create") {

         if (argv.length === 0) {
            return _callback("Nothing to create!");
         }

         if (argv[0] === "group") {
  
            const createGroupDefinitions = [
               { name: 'name', alias: 'n', type: String },
               { name: 'ids', multiple: true, type: String, defaultOption: true }
            ];

            argv.shift();
            const createGroupOptions = commandLineArgs(createGroupDefinitions, { argv, stopAtFirstUnknown: true })
            argv = createGroupOptions._unknown || [];
            return this.executeParsedCommand("createGroup", [ createGroupOptions.name, createGroupOptions.ids ], _callback);
            //return _callback(null, util.inspect(createGroupOptions));
         }
         else {
            return _callback("Currently only support creation of groups!");
         }
      }
      else if (mainCommand.name === "delete") {

         if (argv.length === 0) {
            return _callback("Nothing to delete!");
         }

         if (argv[0] === "group") {
  
            const deleteGroupDefinitions = [
               { name: 'id', alias: 'i', type: String, defaultOption: true }
            ];

            argv.shift();
            const deleteGroupOptions = commandLineArgs(deleteGroupDefinitions, { argv, stopAtFirstUnknown: true })
            argv = deleteGroupOptions._unknown || [];
            return this.executeParsedCommand("deleteGroup", [deleteGroupOptions.id], _callback);
            //return _callback(null, util.inspect(deleteGroupOptions));
         }
         else {
            return _callback("Currently only support deleting of groups!");
         }
      }
   }
   return _callback("Subcommand not found!");
};

module.exports = exports = HueServiceConsoleCmd;
