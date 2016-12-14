var util = require('util');
var PropertyBinder = require('./propertybinder');
var push = require( 'pushover-notifications' );

function PushoverBinder(_config, _owner) {

   this.messagePriority = (_config.priority) ? _config.priority : 0;

   PropertyBinder.call(this, _config, _owner);

   this.pushService = new push( { user: 'hu7KvA9B2qaD5NvHUL4Fki3MBmnxW7h',
                                  token: 'ac7TcmTptiV3Yrh6MZ93xGQsfxp2mV' });

   var that = this;
}

PushoverBinder.prototype.calculateNewOutputValue = function(_sourceListener, _data, _callback) {
   console.log(this.name + ': received property change, property='+ _data.sourcePropertyName + ' value=' + _data.propertyValue);

   var _title = 'Casa Collin' + ((this.messagePriority > 0) ? ' Alarm' : ' Update');
   var _message = (_sourceListener.outputValues[_data.propertyValue] != undefined) ?
                 _sourceListener.outputValues[_data.propertyValue] : _data.propertyValue;

   var msg = {
      user: this.target.getProperty('pushoverDestAddr'),
      message: _message,    // required
      title: _title, 
      retry: 60,
      expire: 3600,
      priority: this.messagePriority,
   };

   var that = this;

   this.pushService.send(msg, function(_err, _result ) {
      if (_err) {
         console.info(that.name + ': Error logging into Pushover: ' + _err);
         return _callback(_err, _result);
      }
      else {
         return _callback(null, _data.propertyValue);
      }
   });
}

util.inherits(PushoverBinder, PropertyBinder);

module.exports = exports = PushoverBinder;

