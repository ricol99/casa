var util = require('util')
var Thing = require('./thing');
var Parent = require('./parent');
var User = require('./user');
//var IpCamera = require('./ipcamera');
var UserGroup = require('./usergroup');
var State = require('./state');
var GpioState = require('./gpiostate');
var Activator = require('./activator');
var GpioAction = require('./gpioaction');
var SpyCameraAction = require('./spycameraaction');
var PushoverAction = require('./pushoveraction');
var ParentState = require('./parentstate');

//////////////////////////////////////////////////////////////////
// Things
//////////////////////////////////////////////////////////////////
var internetParent = new Parent('internet-parent', 'Internet Parent', 'localhost', 7000, 7000, {} );

var richard = new User('richard', 'Richard');
var natalie = new User('natalie', 'Natalie');
var admins = new UserGroup('admins', 'Adminstrators',
                           { pushoverDestAddr: 'gX5JLc28t775dYr1yjuo4p38t7hziV'},
                           { richard: richard });

var keyHolders = new UserGroup('key-holders', 'Key Holders',
                               { pushoverDestAddr: 'g7KTUJvsJbPUNH5SL8oEitXBBuL32j'},
                               { richard: richard, natalie: natalie });

var alarm = new Thing('texecom-prem-elite-48', {}, {} );

var loungePirs = new Thing('lounge-pirs', {}, {} );
//var loungeCamera = new IpCamera('lounge-camera', {}, {} );
var loungeCamera = new Thing('lounge-camera', {}, {} );
//var loungeLight = new Thing('lounge-light', {}, {} );

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var internetParentState = new ParentState('internet-parent', internetParent);

var richardOnWayHomeState = new State('richard-on-way-home', richard)
var natalieOnWayHomeState = new State('natalie-on-way-home', natalie);

var richardHomeState = new State('richard-home', richard);
var natalieHomeState = new State('natalie-home', natalie);

var tamperState = new GpioState('alarm-tamper-alarm', 4, true, alarm);
var mainsFailureState = new GpioState('alarm-mains-failure', 17, true, alarm);
var fireState = new GpioState('alarm-fire-alarm', 18, true, alarm);
var fullyArmedState = new GpioState('alarm-fully-armed', 22, true, alarm);
var partArmedState = new GpioState('alarm-part-armed', 23, true, alarm);
var inAlarmState = new GpioState('alarm-in-alarm', 24, true, alarm);
var confirmedAlarmState = new GpioState('alarm-confirmed-alarm', 25, true, alarm);

var loungePir1 = new GpioState('lounge-1', 27, true, loungePirs);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var internetParentActivator = new Activator('internet-parent', internetParentState, 0, true);
var loungeActivator = new Activator('lounge-pir-1', loungePir1, 15, false);

var tamperActivator = new Activator('alarm-tamper-alarm', tamperState, 0, false);
var mainsFailureActivator = new Activator('alarm-mains-failure', mainsFailureState, 0, false);
var fireStateActivator = new Activator('alarm-fire-alarm', fireState, 0, false);
var fullyArmedActivator = new Activator('alarm-fully-armed', fullyArmedState, 0, false);
var partArmedActivator = new Activator('alarm-part-armed', partArmedState, 0, false);
var inAlarmActivator = new Activator('alarm-in-alarm', inAlarmState, 0, false);
var confirmedAlarmActivator = new Activator('alarm-confirmed-alarm', confirmedAlarmState, 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
//var loungeLight = new GpioAction('lounge', 21 ,true, loungeActivator, loungeLight);
var loungeCam = new SpyCameraAction('lounge', '192.168.1.245', 8000, 'ricol99', 'carrot99', 1, loungeActivator, loungeCamera);

var loungeMessage = new PushoverAction('lounge',
                                       'Security-Alarm: * Motion in lounge * - Started recording', 2,
                                       'Security-Alarm: * Motion in lounge ended * - Finished recording', 0,
                                       loungeActivator, keyHolders);

var tamperMessage = new PushoverAction('alarm-tamper-alarm',
                                       'Security-Info: * Alarm being tampered with! *', 2,
                                       'Security-Info: Alarm no longer in tamper mode', 0,
                                       tamperActivator, keyHolders);

var mainsFailureMessage = new PushoverAction('alarm-mains-failure',
                                             'Security-Info: * Alarm has lost mains power! *', 2,
                                             'Security-Info: Alarm mains power restored', 0,
                                             mainsFailureActivator, keyHolders);

var fireAlarmMessage = new PushoverAction('alarm-fire-alarm',
                                             'Security-Info: * Fire Alarm! *', 2,
                                             'Security-Info: Fire alarm reset', 0,
                                             fireStateActivator, keyHolders);

var fullyArmedMessage = new PushoverAction('alarm-fully-armed',
                                           'Security-Info: Alarm armed', 0,
                                           'Security-Info: Alarm disarmed', 0,
                                           fullyArmedActivator, admins);

var partArmedMessage = new PushoverAction('alarm-part-armed',
                                          'Security-Info: Alarm part armed', 0,
                                          'Security-Info: Alarm disarmed', 0,
                                          partArmedActivator, admins);

var alarmInAlarmMessage = new PushoverAction('alarm-in-alarm',
                                             'Security-Alarm: Alarm triggered', 2,
                                             'Security-Alarm: Alarm disarmed', 2,
                                             inAlarmActivator, keyHolders);

var confirmedAlarmMessage = new PushoverAction('alarm-confirmed-alarm',
                                               'Security-Info: Alarm confirmed triggered - call police!', 2,
                                               'Security-Info: Alarm disarmed', 2,
                                               confirmedAlarmActivator, keyHolders);

//var internetParentMessage = new PushoverAction('internet-parent',
                                               //'Security-Info: Internet connection lost!,',
                                               //'Security-Info: Connected to Internet!',
                                               //2, internetParentActivator, keyHolders);

