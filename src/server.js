var util = require('util')
var Thing = require('./thing');
var Casa = require('./casa');
var PeerCasa = require('./peercasa');
var User = require('./user');
var UserGroup = require('./usergroup');
var State = require('./state');
var Activator = require('./activator');
var AndActivator = require('./and-activator');
var PushoverAction = require('./pushoveraction');
var PeerCasaState = require('./peercasastate');

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

var internetCasa = new Casa('internet', 'Internet Casa', 80, casaCollin, {});

var alarmCasa = new PeerCasa('casa-collin-alarm', 'Texecom Alarm Casa',
                            { hostname: 'collin.viewcam.me', port: 10002 },
                            internetCasa, casaCollin, {});

var cctvCasa = new PeerCasa('casa-collin-cctv', 'CCTV Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10003 }, 
                            internetCasa, casaCollin, {});

var lightCasa = new PeerCasa('casa-collin-light', 'Light Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10004 },
                            internetCasa,  casaCollin, {});

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var alarmCasaState = new PeerCasaState('alarm-casa', alarmCasa, false);
//var cctvCasaState = new PeerCasaState('cctv-casa', cctvCasa, false);
//var lightCasaState = new PeerCasaState('light-casa', lightCasa, false);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var alarmCasaActivator = new Activator('alarm-casa-casa', alarmCasaState, 0, true);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
var alarmCasaMessage = new PushoverAction('internet-parent',
                                          'Security-Info: Internet connection lost!,', 2, 
                                          'Security-Info: Connected to Internet!', 0,
                                          alarmCasaActivator, admins);

