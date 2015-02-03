var util = require('util')
var Thing = require('./thing');
var State = require('./state');
var GpioState = require('./gpiostate');
var Activator = require('./activator');
var GpioAction = require('./gpioaction');
var SpyCameraAction = require('./spycameraaction');
var PushoverAction = require('./pushoveraction');

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var richardOnWayHomeState = new State('richard-on-way-home');
var natalieOnWayHomeState = new State('natalie-on-way-home');

var richardHomeState = new State('richard-home');
var natalieHomeState = new State('natalie-home');

var fullyArmedState = new GpioState('fully-armed', 4, true);
var partArmedState = new GpioState('part-armed', 12, true);
var inAlarmState = new GpioState('alarm-in-alarm', 16, true);
var confirmedAlarmState = new GpioState('alarm-confirmed-alarm', 20, true);

var loungePir1 = new GpioState('lounge-1', 17, true);

//////////////////////////////////////////////////////////////////
// Things
//////////////////////////////////////////////////////////////////
var richard = new Thing('richard',
                        { 'richard-on-way-home' : richardOnWayHomeState,
                          'richard-home'        : richardHomeState }, {} );

var natalie = new Thing('natalie',
                        { 'natalie-on-way-home' : natalieOnWayHomeState,
                          'natalie-home'        : natalieHomeState }, {} );

var keyHolders = new Thing('key-holders', {}, {} );
var reserveKeyHolders = new Thing('reserve-key-holders', {}, {} );

var alarm = new Thing('texecom-prem-elite-48',
                      { 'fully-armed'     : fullyArmedState,
                        'part-armed'      : partArmedState,
                        'in-alarm'        : inAlarmState,
                        'confirmed-alarm' : confirmedAlarmState }, {} );

var loungePirs = new Thing('lounge-pirs', { 'lounge-pir-1' : loungePir1 }, {} );
var loungeCamera = new Thing('lounge-camera', {}, {} );

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

