var util = require('util');
var Thing = require('../thing');

function McpSpiAdcChannel(_config, _parent) {
   Thing.call(this, _config, _parent);
   this.thingType = "mcp-scp-adc-channel";
   this.displayName = _config.displayName;
   this.channelId = _config.channelId;
   this.interval = (_config.hasOwnProperty("interval")) ? _config.interval : 10000;
   this.serviceName = (_config.hasOwnProperty("serviceName")) ? _config.serviceName :  this.gang.casa.findServiceName("mcpspiadcservice");

   if (!this.serviceName) {
      console.error(this.uName + ": ***** MCP SPI ADC service not found! *************");
      process.exit();
   }

   this.ensurePropertyExists('reading', 'serviceproperty', { id: this.channelId, serviceType: "channel", serviceName: this.serviceName, sync: "read" }, _config);
   this.ensurePropertyExists('interval', 'serviceproperty', { id: this.channelId, serviceType: "channel", serviceName: this.serviceName, sync: "write" }, _config);
}

util.inherits(McpSpiAdcChannel, Thing);

module.exports = exports = McpSpiAdcChannel;
