var util = require('util');
var Service = require('../service');

var ffi = require('ffi-napi');

var widgetlords = ffi.Library('libwidgetlords', {
        'pi_spi_init': [ 'void', [] ],
        'pi_spi_8ai_read_single': [ 'uint16', [ 'uint8', 'uint8' ] ]
});

function WidgetLordService(_config, _owner) {
   _config.queueQuant = 50;
   _config.deviceTypes = { "channel": "mcpspiadcchannel" };
   
   Service.call(this, _config, _owner);
   widgetlords.pi_spi_init();
   this.channels = [null, null, null, null, null, null, null, null];
}

util.inherits(WidgetLordService, Service);

// Called when current state required
WidgetLordService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
WidgetLordService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

WidgetLordService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
};

WidgetLordService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
};

WidgetLordService.prototype.fetchReading = function(_id, _callback) {
   var serviceNode = this.findOrCreateNode("channel", _id);
   serviceNode.fetchReading(_callback);
};

WidgetLordService.prototype.openMcpChannel = function(_channel, _callback) {

   if (!this.channels[parseInt(_channel)]) {
      this.channels[parseInt(_channel)] = new WidgetLordChannel(_channel);
   }
   _callback(null, true);
   return this.channels[parseInt(_channel)];
};

function WidgetLordChannel(_channel) {
   this.channel = _channel;
}

WidgetLordChannel.prototype.read = function(_callback) {

   try {
      _callback(null, { value: widgetlords.pi_spi_8ai_read_single(parseInt(this.channel),0) });
   }
   catch(_error) {
      _callback(_error);
   }
};

WidgetLordChannel.prototype.close = function() {
};

module.exports = exports = WidgetLordService;
 
