Thing = require('./thing');
GpioState = require('./gpiostate');
GpioAction = require('./gpioaction');
SpyCameraAction = require('./spycameraaction');
Activator = require('./activator');

var fullyArmedState = GpioState.create('fullyArmed', 25, true);

var alarm = Thing.create('texecom-prem-elite-48',
                         { 'fullyArmed'     : fullyArmedState,
                           'partArmed'      : GpioState.create('partArmed', 12, true),
                           'alarm'          : GpioState.create('alarm', 16, true),
                           'confirmedAlarm' : GpioState.create('confirmedAlarm', 20, true) }, {} );

var loungePir = GpioState.create('lounge', 17, true);
var loungeActivator = Activator.create('lounge-pir-cam', loungePir, 15, false);
var loungeCam = SpyCameraAction.create('lounge', '192.168.1.245', 8000, 'ricol99', 'carrot99', 1, loungeActivator);
var loungeLight = GpioAction.create('lounge', 21 ,true, loungeActivator);

