var util = require('util');
var PropertyBinder = require('./propertybinder');
//var i2c = require('i2c');

function I2CPropertyBinder(_config, _source) {

   PropertyBinder.call(this, _config, _source);

   this.address = _config.address;
   //this.wire = new i2c(address, { device: '/dev/i2c-1' }); // point to your i2c address, debug provides REPL interface  
   var that = this;
}

util.inherits(I2CPropertyBinder, PropertyBinder);

I2CPropertyBinder.prototype.setProperty = function(_propValue, _callback) {
   console.log(this.name + ': Attempting to set property ' + this.propertyName + ' to ' + _propValue);
   _callback(false);
}

//wire.scan(function(err, data) {
  //// result contains an array of addresses 
//});
 //
//wire.writeByte(byte, function(err) {});
 //
//wire.writeBytes(command, [byte0, byte1], function(err) {});
 //
//wire.readByte(function(err, res) { // result is single byte }) 
 //
//wire.readBytes(command, length, function(err, res) {
  //// result contains a buffer of bytes 
//});
 //
//wire.on('data', function(data) {
  //// result for continuous stream contains data buffer, address, length, timestamp 
//});
 //
//wire.stream(command, length, delay); // continuous stream, delay in ms 
 //
 //
//// plain read/write 
 //
//wire.write([byte0, byte1], function(err) {});
 //
//wire.read(length, function(err, res) {
  //// result contains a buffer of bytes 
//});
 


module.exports = exports = I2CPropertyBinder;
 
