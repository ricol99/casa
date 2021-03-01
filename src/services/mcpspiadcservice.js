var util = require('util');
var McpSpiAdc = require('mcp-spi-adc');
var Service = require('../service');

function McpSpiAdcService(_config, _owner) {
   _config.queueQuant = 50;
   _config.deviceTypes = { "channel": "mcpspiadcchannel" };
   
   Service.call(this, _config, _owner);
   this.mcpDevice = _config.hasOwnProperty("mcpDevice") ? _config.mcpDevice : 3008;

   if (_config.hasOwnProperty("busSpeed")) {
      this.busSpeed = _config.busSpeed;
   }
   else {
      var busSpeedMap = { 3002: 1200000, 3004: 1350000, 3008: 1350000, 3202: 900000, 3204: 1000000, 3208: 1000000 };
      this.busSpeed busSpeedMap[this.mcpDevice);
   }
}

util.inherits(McpSpiAdcService, Service);

McpSpiAdcService.prototype.fetchReading = function(_id, _callback) {
   var serviceNode = this.findOrCreateNode("channel", _id);
   serviceNode.fetchReading(_callback);
};

McpSpiAdcService.prototype.openMcpChannel = function(_channel, _callback) {
   var fn = "openMcp"+this.mcpDevice.toString();

   McpSpiAdc.call(this, fn, _channel, this.busSpeed, _callback);
};

module.exports = exports = McpSpiAdcService;
 
