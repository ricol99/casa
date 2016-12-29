var util = require('util');
var PropertyBinder = require('./propertybinder');
//var i2c = require('i2c');

var i2c = require('i2c-bus');

var DS1621_ADDR = 0x48,
  CMD_ACCESS_CONFIG = 0xac,
  CMD_READ_TEMP = 0xaa,
  CMD_START_CONVERT = 0xee;

  //i2c1.writeByteSync(DS1621_ADDR, CMD_ACCESS_CONFIG, 0x01);

  //// Wait while non volatile memory busy
  //while (i2c1.readByteSync(DS1621_ADDR, CMD_ACCESS_CONFIG) & 0x10) {
  //}

  //// Start temperature conversion
  //i2c1.sendByteSync(DS1621_ADDR, CMD_START_CONVERT);

  //// Wait for temperature conversion to complete
  //while ((i2c1.readByteSync(DS1621_ADDR, CMD_ACCESS_CONFIG) & 0x80) === 0) {
  //}

  //// Display temperature
  //rawTemp = i2c1.readWordSync(DS1621_ADDR, CMD_READ_TEMP);
  //console.log('temp: ' + toCelsius(rawTemp));

  //i2c1.closeSync();
//}());

function I2CPropertyBinder(_config, _owner) {

   PropertyBinder.call(this, _config, _owner);

   this.address = _config.address;
   var that = this;

   process.on('SIGINT', function() {
      if (that.wire) {
  	that.wire.closeSync();
      }
   });

}

util.inherits(I2CPropertyBinder, PropertyBinder);

I2CPropertyBinder.prototype.setProperty = function(_propValue, _data, _callback) {
   console.log(this.name + ': Attempting to set property ' + this.propertyName + ' to ' + _propValue);
   _callback(false);
}

I2CPropertyBinder.prototype.coldStart = function() {
   var that = this;
   this.wire = i2c.openSync(1);

   //this.wire = new i2c(this.address, { device: '/dev/i2c-1' }); // point to your i2c address, debug provides REPL interface  
   setInterval(function() {
	rawTemp = that.wire.readWordSync(that.address, CMD_READ_TEMP);
	console.log("Read byte for i2c bus: " + rawTemp);
	//that.wire.readByte(function(_err, _result) {
		//if (_err) {
			//console.error("Error for i2c bus: " + _err);
		//}
		//else {
			//console.log("Read byte for i2c bus: " + _result);
		//}
	//});
   }, 1000);
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
 
