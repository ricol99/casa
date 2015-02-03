var util = require('util')
var Thing = require('./thing');
var State = require('./state');
var GpioState = require('./gpiostate');
var Activator = require('./activator');
var GpioAction = require('./gpioaction');
var SpyCameraAction = require('./spycameraaction');
var PushoverAction = require('./pushoveraction');


//////////////////////////////////////////////////////////////////
// Things
//////////////////////////////////////////////////////////////////
var richard = new Thing('richard', {}, {} );
var natalie = new Thing('natalie', {}, {} );
var keyHolders = new Thing('key-holders', {}, {} );
var reserveKeyHolders = new Thing('reserve-key-holders', {}, {} );

var alarm = new Thing('texecom-prem-elite-48', {}, {} );

var loungePirs = new Thing('lounge-pirs', {}, {} );
var loungeCamera = new Thing('lounge-camera', {}, {} );

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var richardOnWayHomeState = new State('richard-on-way-home', richard)
var natalieOnWayHomeState = new State('natalie-on-way-home', natalie);

var richardHomeState = new State('richard-home', richard);
var natalieHomeState = new State('natalie-home', natalie);

var fullyArmedState = new GpioState('fully-armed', 4, true, alarm);
var partArmedState = new GpioState('part-armed', 12, true, alarm);
var inAlarmState = new GpioState('alarm-in-alarm', 16, true, alarm);
var confirmedAlarmState = new GpioState('alarm-confirmed-alarm', 20, true, alarm);

var loungePir1 = new GpioState('lounge-1', 17, true, loungePirs);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var loungeActivator = new Activator('lounge-pir-1', loungePir1, 15, false);

var fullyArmedActivator = new Activator('alarm-fully-armed', fullyArmedState, 0, false);
// var partArmedActivator = new Activator('alarm-part-armed', partArmedState, 0, false);
// var inAlarmActivator = new Activator('alarm-in-alarm', inAlarmState, 0, false);
// var confirmedAlarmActivator = new Activator('alarm-confirmed-alarm', confirmedAlarmState, 0, false);
var partArmedActivator = new Activator('alarm-part-armed', fullyArmedState, 0, false);
var inAlarmActivator = new Activator('alarm-in-alarm', fullyArmedState, 0, false);
var confirmedAlarmActivator = new Activator('alarm-confirmed-alarm', fullyArmedState, 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
var loungeLight = new GpioAction('lounge', 21 ,true, loungeActivator);
var loungeCam = new SpyCameraAction('lounge', '192.168.1.245', 8000, 'ricol99', 'carrot99', 1, loungeActivator);

var loungeMessage = new PushoverAction('lounge',
                                       'Security-Alarm: * Motion in lounge * - Started recording',
                                       'Security-Alarm: * Motion in lounge ended * - Finished recording',
                                       2, loungeActivator);

var fullyArmedMessage = new PushoverAction('alarm-fully-armed',
                                           'Security-Info: Alarm armed',
                                           'Security-Info: Alarm disarmed',
                                           0, fullyArmedActivator);

var partArmedMessage = new PushoverAction('alarm-part-armed',
                                          'Security-Info: Alarm part armed',
                                          'Security-Info: Alarm disarmed',
                                          0, partArmedActivator);

var alarmInAlarmMessage = new PushoverAction('alarm-in-alarm',
                                             'Security-Alarm: Alarm triggered',
                                             'Security-Alarm: Alarm disarmed',
                                             2, inAlarmActivator);

var confirmedAlarmMessage = new PushoverAction('alarm-confirmed-alarm',
                                               'Security-Info: Alarm confirmed triggered - call police!',
                                               'Security-Info: Alarm disarmed',
                                               2, confirmedAlarmActivator);

