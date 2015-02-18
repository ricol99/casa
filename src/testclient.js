var util = require('util')
var Thing = require('./thing');
var CasaArea = require('./casaarea');
var Casa = require('./casa');
var PeerCasa = require('./peercasa');
var User = require('./user');
var UserGroup = require('./usergroup');
var State = require('./state');
var Activator = require('./activator');
var AndActivator = require('./andactivator');
var PushoverAction = require('./pushoveraction');
var PeerState = require('./peerstate');

//////////////////////////////////////////////////////////////////
// Things and Users
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

//////////////////////////////////////////////////////////////////
// Areas
//////////////////////////////////////////////////////////////////
var internet = new CasaArea('internet', 'Casa Collin Internet', casaCollin);
var home = new CasaArea('home', 'Casa Collin Home', casaCollin);

//////////////////////////////////////////////////////////////////
// Casa Installations
//////////////////////////////////////////////////////////////////
var internetCasa = new PeerCasa('internet', 'Internet Casa',
                            { hostname: 'casa.elasticbeanstalk.com', port: 80 },
                            alarmCasa, internet, true, {});

var alarmCasa = new Casa('alarm', 'Texecom Alarm Casa', 10002, home, internet, {});

var cctvCasa = new PeerCasa('cctv', 'CCTV Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10003 }, 
                            alarmCasa, home, false, {});

var lightCasa = new PeerCasa('light', 'Light Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10004 },
                            alarmCasa, home, false, {});

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

