var util = require('util');
var PropertyBinder = require('./propertybinder');
//var i2c = require('i2c');
var i2c = require('ABElectronics_NodeJS_Libraries/lib/adcpi/adcpi');


var adc = new ADCPi(0x68, 0x69, 18);


while (1) {
    console.log('Reading 1: ' + adc.readVoltage(1));
    console.log('Reading 2: ' + adc.readVoltage(2));
    console.log('Reading 3: ' + adc.readVoltage(3));
    console.log('Reading 4: ' + adc.readVoltage(4));
    console.log('Reading 5: ' + adc.readVoltage(5));
    console.log('Reading 6: ' + adc.readVoltage(6));
    console.log('Reading 7: ' + adc.readVoltage(7));
    console.log('Reading 8: ' + adc.readVoltage(8));

}


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

   this.address1 = _config.address1;
   this.address2 = _config.address2;
   this.channel = _config.channel;
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
   this.wire = new ADCPi(this.address1, this.address2, 18);

   setInterval(function() {
      console.log('Reading 1: ' + that.wire.readVoltage(that.channel));
   }, 1000);
   //this.wire = new i2c(this.address, { device: '/dev/i2c-1' }); // point to your i2c address, debug provides REPL interface  
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
 
