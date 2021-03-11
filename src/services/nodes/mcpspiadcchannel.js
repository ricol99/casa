var util = require('util');
var ServiceNode = require('./servicenode');
var McpSpiAdc = require('mcp-spi-adc');

function McpSpiAdcChannel(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.writable = false;

   console.log(this.uName + ": New MCP SPI ADC channel created");
   this.ready = false;
   this.listening = false;
   this.interval = 100000000000;

   this.ensurePropertyExists("reading", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
   this.ensurePropertyExists("interval", 'property', { initialValue: 10000, allSourcesRequiredForValidity: false });
}

util.inherits(McpSpiAdcChannel, ServiceNode);

McpSpiAdcChannel.prototype.newSubscriptionAdded = function(_subscription) {

   if (_subscription.interval < this.interval) {
      this.interval = _subscription.interval;
      this.alignPropertyValue('interval', this.interval);
   }
   
   if (!this.listening) {
      this.initialiseAndStartListening();
   }
   else {
      this.startListening();
   }
};

McpSpiAdcChannel.prototype.initaliseAndStartListening = function() {
   this.listening = true;

   this.mcpAdcChannel = this.owner.openMcpChannel(this.id, (_err) => {

      if (_err) {
         console.error(this.uName + ": Unable to open MCP SPI ADC on channel " + this.id + ", error = " + _err);
         return;
      }

      this.ready = true;
      this.startListening();
   });
}

McpSpiAdcChannel.prototype.startListening = function () {

   if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
   }

   this.intervalTimer = setInterval( () => {

      this.mcpAdcChannel.read( (_err, _reading) => {
 
         if (_err) {
            console.error(this.uName + ": Unable to read channel, error = " + _err);
         }
         else {
            this.alignPropertyValue('reading', _reading);
         }
      });
   }, this.interval);
      
   process.on('SIGINT', () => {

      if (this.mcpAdcChannel) {
         this.mcpAdcChannel.close();
      }
   });

};

McpSpiAdcChannel.prototype.fetchReading = fetchReading(_callback) {
   var transaction = { action: "fetchReading", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
McpSpiAdcChannel.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

McpSpiAdcChannel.prototype.processPropertyChanged = function(_transaction, _callback) {

   if (_transaction.props && _transaction.props.hasOwnProperty("interval")) {
      this.interval = _transaction.props.interval;

      if (this.ready) {
         this.startListening();
      }
   }
   _callback(null, true);
};

McpSpiAdcChannel.prototype.processFetchReading = function(_transaction, _callback) {

   if (this.ready && this.mcpAdcChannel) {
      this.mcpAdcChannel.read(_callback);
   }
   else {
      return _callback("Not read to read from MCP SPI ADC");
   }
};

module.exports = exports = McpSpiAdcChannel;

