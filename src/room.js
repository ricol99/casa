var util = require('util');
var Thing = require('./thing');

function Room(_config) {

   Thing.call(this, _config);
   this.setMaxListeners(20);
   this.props['manual-mode'] = false;

   var that = this;
}

util.inherits(Room, Thing);

Room.prototype.activateManualOverride = function(_endDate) {
   console.log(this.name + ': Room moving to manual mode until ' + _endDate);
   this.updateProperty('manual-mode', true, { sourceName: this.name} );

	if (_endDate != undefined) {
		this.deactivateManualOverride(_endDate);
	}
};

Room.prototype.deactivateManualOverride = function(_when) {
   var that = this;

	if (_when != undefined) {
	  	var waitTime = _when.getTime() - (new Date()).getTime();

		setTimeout(function() {
			console.log(that.name + ': Room moving back to automatic mode');
			that.updateProperty('manual-mode', false, { sourceName: that.name} );
	  	}, waitTime);
	}
	else {
		console.log(this.name + ': Room moving back to automatic mode');
		this.updateProperty('manual-mode', false, { sourceName: this.name} );
	}
};

module.exports = exports = Room;
