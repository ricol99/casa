var util = require('util');
var SourceConsoleCmd = require('./sourceconsolecmd');
function BuildingConsoleCmd(config, owner, console) { SourceConsoleCmd.call(this, config, owner, console); }
util.inherits(BuildingConsoleCmd, SourceConsoleCmd);
BuildingConsoleCmd.prototype.listScenes = function(args, callback) { return this.executeSceneCommand('listScenes', args, 0, callback); };
BuildingConsoleCmd.prototype.getSceneStatus = function(args, callback) { return this.executeSceneCommand('getSceneStatus', args, 0, callback); };
BuildingConsoleCmd.prototype.setScene = function(args, callback) { return this.executeSceneCommand('setScene', args, 1, callback); };
BuildingConsoleCmd.prototype.releaseScene = function(args, callback) { return this.executeSceneCommand('releaseScene', args, 0, callback); };
BuildingConsoleCmd.prototype.executeSceneCommand = function(command, args, count, callback) {
   args = args || [];
   var usage = 'Usage: ' + command + (count ? ' <name>' : '');
   if (args.length === 1 && (args[0] === '--help' || args[0] === '--usage')) {
      this.console.write(usage); return callback(null, true);
   }
   if (args.length !== count || (count && (typeof args[0] !== 'string' || !args[0].trim()))) return callback(usage);
   return this.executeParsedCommand(command, args, callback);
};
module.exports = BuildingConsoleCmd;
