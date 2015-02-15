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
var PeerState = require('./peerstate');

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

var alarmCasa = new Casa('casa-collin-alarm', 'Texecom Alarm Casa', 10002, casaCollin, {});

var internetCasa = new PeerCasa('internet', 'Internet Casa',
                            { hostname: 'casa.elasticbeanstalk.com', port: 7000 },
                            alarmCasa, casaCollin, true, {});

var cctvCasa = new PeerCasa('casa-collin-cctv', 'CCTV Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10003 }, 
                            alarmCasa, casaCollin, false, {});

var lightCasa = new PeerCasa('casa-collin-light', 'Light Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10004 },
                            alarmCasa,  casaCollin, false, {});

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var weatherWetState = new PeerState('weather-state', internetCasa);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var internetCasaActivator = new Activator('internet-casa', internetCasa, 0, false);
var wetWeatherActivator = new Activator('wet-weather', weatherWetState, 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
var wetWeatherMessage = new PushoverAction('wet-weather',
                                          'Info: It is going to rain!', 0,
                                          'Info: the rain has gone!', 0, 
                                          wetWeatherActivator, admins);

