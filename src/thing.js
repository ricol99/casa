var util = require('util');
var Source = require('./source');

function Thing(_config) {
	this.displayName = _config.displayName;
	this.sources = {};
	this.thingType = _config.type;

	Source.call(this, _config);

	if (this.props['manual-mode'] == undefined) {
		this.props['manual-mode'] = false;		
	}
}

util.inherits(Thing, Source);

Thing.prototype.addSource = function(_source) {
   this.sources[_source.name] = _source;
};

Thing.prototype.setProperty = function(_propName, _propValue, _data, _callback) {

	if (_propName == 'manual-mode') {

		if (_propValue) {
			this.activateManualMode();
		}
		else {
			this.deactivateManualMode();
		}
	}

	Source.prototype.setProperty.call(this, _propName, _propValue, _data, _callback);
};

Thing.prototype.updateProperty = function(_propName, _propValue, _data) {

	if (_propName == 'manual-mode') {

		if (_propValue) {
			this.setManualMode(true);
		}
		else {
			this.setManualMode(false);
		}
	}

	Source.prototype.updateProperty.call(this, _propName, _propValue, _data);
};

Thing.prototype.setManualMode = function(_mode) {
   console.log(this.name + ': Thing moving manual mode to ' + _mode);

	for (var source in this.sources) {

		if (this.sources.hasOwnProperty(source)) {
			this.sources[source].setManualMode(_mode);
		}
	}

	Source.prototype.setManualMode.call(this, _mode);
};

Thing.prototype.activateManualMode = function(_endDate) {
   this.updateProperty('manual-mode', true, { sourceName: this.name} );
   this.setManualMode(true);

	if (_endDate != undefined) {
		this.deactivateManualMode(_endDate);
	}
};

Thing.prototype.deactivateManualMode = function(_when) {
	var that = this;

	if (_when != undefined) {
	  	var waitTime = _when.getTime() - (new Date()).getTime();

		setTimeout(function() {
			console.log(that.name + ': Thing moving back to automatic mode');
			that.updateProperty('manual-mode', false, { sourceName: that.name} );
			that.setManualMode(false);
	  	}, waitTime);
	}
	else {
		console.log(this.name + ': Thing moving back to automatic mode');
		this.updateProperty('manual-mode', false, { sourceName: this.name} );
		this.setManualMode(false);
	}
};

module.exports = exports = Thing;
