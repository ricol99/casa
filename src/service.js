function Service(_config) {
   this.uName = _config.name;
   this.displayName = _config.displayName;
}

Service.prototype.coldStart = function() {
};

module.exports = exports = Service;
