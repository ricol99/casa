var util = require('util')
var Thing = require('./thing');
var Casa = require('./casa');
var PeerCasa = require('./peercasa');
var User = require('./user');
//var IpCamera = require('./ipcamera');
var UserGroup = require('./usergroup');
var State = require('./state');
var GpioState = require('./gpiostate');
var Activator = require('./activator');
var AndActivator = require('./and-activator');
var GpioAction = require('./gpioaction');
var SpyCameraAction = require('./spycameraaction');
var PushoverAction = require('./pushoveraction');
var PeerCasaConnState = require('./peercasaconnstate');

//////////////////////////////////////////////////////////////////
// Things
//////////////////////////////////////////////////////////////////
var casaCollin = new Thing('collin', 'Casa Collin Home', null, {} );

var richard = new User('richard', 'Richard', casaCollin);
var natalie = new User('natalie', 'Natalie', casaCollin);
var admins = new UserGroup('admins', 'Adminstrators',
                           { richard: richard }, casaCollin,
                           { pushoverDestAddr: 'gX5JLc28t775dYr1yjuo4p38t7hziV'});

var keyHolders = new UserGroup('key-holders', 'Key Holders',
                               { richard: richard, natalie: natalie }, casaCollin,
                               { pushoverDestAddr: 'g7KTUJvsJbPUNH5SL8oEitXBBuL32j'});

var alarmCasa = new Casa('casa-collin-alarm', 'Texecom Alarm', 10002, casaCollin, {});

var internetCasa = new PeerCasa('internet', 'Internet Peer Casa',
                                { hostname: 'casa.elasticbeanstalk.com', port: 80 }, 
                                alarmCasa, casaCollin, {});

var cctvCasa = new PeerCasa('casa-collin-cctv', 'CCTV Peer Casa',
                            { hostname: 'pi-cctv', port: 9000 },
                            alarmCasa, casaCollin, {});

var lightCasa = new PeerCasa('casa-collin-light', 'Light Peer Casa',
                             { hostname: 'pi-light', port: 8000 },
                             alarmCasa,  casaCollin, {});

var loungePirs = new Thing('lounge-pirs', 'Lounge PIRs', alarmCasa, {} );

//var loungeCamera = new IpCamera('lounge-camera', 'Lounge Camera', cctvCasa, {} );
var loungeCamera = new Thing('lounge-camera', 'Lounge Camera', cctvCasa, {} );

//var loungeLight = new Thing('lounge-light', 'Lounge Light', lightCasa, {} );

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var internetCasaState = new PeerCasaConnState('internet-casa', internetCasa, true);
var cctvCasaState = new PeerCasaConnState('cctv-casa', cctvCasa, false);
var lightCasaState = new PeerCasaConnState('light-casa', lightCasa, false);

var richardOnWayHomeState = new State('richard-on-way-home', richard)
var natalieOnWayHomeState = new State('natalie-on-way-home', natalie);

var richardHomeState = new State('richard-home', richard);
var natalieHomeState = new State('natalie-home', natalie);

var tamperState = new GpioState('alarm-tamper-alarm', 4, true, alarmCasa);
var mainsFailureState = new GpioState('alarm-mains-failure', 17, true, alarmCasa);
var fireState = new GpioState('alarm-fire-alarm', 18, true, alarmCasa);
var fullyArmedState = new GpioState('alarm-fully-armed', 22, true, alarmCasa);
var partArmedState = new GpioState('alarm-part-armed', 23, true, alarmCasa);
var inAlarmState = new GpioState('alarm-in-alarm', 24, true, alarmCasa);
var confirmedAlarmState = new GpioState('alarm-confirmed-alarm', 25, true, alarmCasa);

var loungePir1 = new GpioState('lounge-1', 27, true, loungePirs);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var internetCasaActivator = new Activator('internet-casa', internetCasaState, 0, false);
var loungeActivator = new Activator('lounge-pir-1', loungePir1, 15, false);	// Gives me a minimum of 15 seconds recording time

var tamperActivator = new Activator('alarm-tamper-alarm', tamperState, 0, false);
var mainsFailureActivator = new Activator('alarm-mains-failure', mainsFailureState, 0, false);
var fireStateActivator = new Activator('alarm-fire-alarm', fireState, 0, false);
var fullyArmedActivator = new Activator('alarm-fully-armed', fullyArmedState, 0, false);
var partArmedActivator = new Activator('alarm-part-armed', partArmedState, 0, false);
var inAlarmActivator = new Activator('alarm-in-alarm', inAlarmState, 0, false);
var confirmedAlarmActivator = new Activator('alarm-confirmed-alarm', confirmedAlarmState, 0, false);

// Work around the mimic-arm problem with part-arm
var loungeFullyArmedActivator = new AndActivator('lounge-activity', [ loungeActivator, fullyArmedState ], 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
//var loungeLight = new GpioAction('lounge', 21 ,true, loungeActivator, loungeLight);

var loungeCam = new SpyCameraAction('lounge', '192.168.1.245', 8000, 'ricol99', 'carrot99', 1, loungeFullyArmedActivator, loungeCamera);

var loungeMessage = new PushoverAction('lounge',
                                       'Security-Alarm: * Motion in lounge * - Started recording', 2,
                                       'Security-Alarm: * Motion in lounge ended * - Finished recording', 0,
                                       loungeFullyArmedActivator, keyHolders);

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
                                               //'Security-Info: Connected to Internet!', 0,
                                               //'Security-Info: Internet connection lost!', 2,
                                               //2, internetParentActivator, admins);

