var util = require('util');
var ServiceNode = require('./servicenode');
var McpSpiAdc = require('mcp-spi-adc');

function McpSpiAdcChannel(_config, _owner) {
   ServiceNode.call(this, _config, _owner);
   this.writable = false;

   console.log(this.uName + ": New MCP SPI ADC channel created");
   this.ready = false;
   this.initialisationStarted = false;

   this.ensurePropertyExists("reading", 'property', { initialValue: false, allSourcesRequiredForValidity: false });
   this.ensurePropertyExists("interval", 'property', { initialValue: 1000000, allSourcesRequiredForValidity: false });
}

util.inherits(McpSpiAdcChannel, ServiceNode);

McpSpiAdcChannel.prototype.newSubscriptionAdded = function(_subscription) {

   if (_subscription.interval < this.getProperty("interval")) {
      this.alignPropertyValue('interval', _subscription.interval);
   }
   
   if (!this.initialisationStarted) {
      this.initialiseAndStartListening();
   }
   else {
      this.restartListening();
   }
};

McpSpiAdcChannel.prototype.initialiseAndStartListening = function() {
   this.initialisationStarted = true;

   this.mcpAdcChannel = this.owner.openMcpChannel(this.id, (_err) => {
      console.log(this.uName + ": AAAAAA Here!");

      if (_err) {
         console.error(this.uName + ": Unable to open MCP SPI ADC on channel " + this.id + ", error = " + _err);
         this.initialisationStarted = false;
         return;
      }

      this.ready = true;
      this.restartListening();
   });
}

McpSpiAdcChannel.prototype.restartListening = function () {

   if (!this.ready) {
      return;
   }

   if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
   }

   this.intervalTimer = setInterval( () => {

      this.mcpAdcChannel.read( (_err, _reading) => {
 
         if (_err) {
            console.error(this.uName + ": Unable to read channel, error = " + _err);
         }
         else if (_reading.value !== this.getProperty("reading")) {
            console.log(this.uName+": Raw Reading: ", _reading);
            this.alignPropertyValue('reading', _reading.value);
         }
      });
   }, this.getProperty("interval"));
      
   process.on('SIGINT', () => {

      if (this.mcpAdcChannel) {
         this.mcpAdcChannel.close();
      }
   });

};

McpSpiAdcChannel.prototype.fetchReading = function(_callback) {
   var transaction = { action: "fetchReading", callback: _callback };
   this.owner.queueTransaction(this, transaction);
};
      
McpSpiAdcChannel.prototype.transactionReadyForProcessing = function(_transaction) {
   return true;
};

McpSpiAdcChannel.prototype.processPropertyChanged = function(_transaction, _callback) {

   if (_transaction.props && _transaction.props.hasOwnProperty("interval")) {

      if (!this.initialisationStarted) {
         this.initialiseAndStartListening();
      }
      else if (this.ready) {
         this.restartListening();
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

