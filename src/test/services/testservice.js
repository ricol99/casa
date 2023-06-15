var util = require('../../util');
var Service = require('../../service');

function TestService(_config, _owner) {
   Service.call(this, _config, _owner);

   this.deviceTypes = {
      "dev": "testdevice"
   };
}

util.inherits(TestService, Service);

TestService.prototype.createNode = function(_config, _loadPath) {
   return Service.prototype.createNode.call(this, _config, "test/services/nodes");
};

// Called when current state required
TestService.prototype.export = function(_exportObj) {
   Service.prototype.export.call(this, _exportObj);
};

// Called when current state required
TestService.prototype.import = function(_importObj) {
   Service.prototype.import.call(this, _importObj);
};

TestService.prototype.coldStart = function() {
   Service.prototype.coldStart.call(this);
   this.start();
};

TestService.prototype.hotStart = function() {
   Service.prototype.hotStart.call(this);
   this.start();
};

TestService.prototype.start = function() {
};

module.exports = exports = TestService;
