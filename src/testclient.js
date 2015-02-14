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

var alarmCasa = new Casa('casa-collin-alarm', 'Texecom Alarm Casa', 7001, casaCollin, {});

var internetCasa = new PeerCasa('internet', 'Internet Casa',
                            { hostname: 'localhost', port: 7000 },
                            alarmCasa, casaCollin, {});

var cctvCasa = new PeerCasa('casa-collin-cctv', 'CCTV Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10003 }, 
                            alarmCasa, casaCollin, {});

var lightCasa = new PeerCasa('casa-collin-light', 'Light Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10004 },
                            alarmCasa,  casaCollin, {});

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var internetCasaState = new PeerCasaState('internet-casa', internetCasa, true);
//var cctvCasaState = new PeerCasaState('cctv-casa', cctvCasa, false);
//var lightCasaState = new PeerCasaState('light-casa', lightCasa, false);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var internetCasaActivator = new Activator('internet-casa', internetCasaState, 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
var internetCasaMessage = new PushoverAction('internet-casa',
                                          'Security-Info: Connected to Internet!', 0,
                                          'Security-Info: Internet connection lost!,', 2, 
                                          internetCasaActivator, admins);

