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
var internetCasa = new Casa('internet', 'Internet Casa', process.env.PORT, internet, null, {});

var alarmCasa = new PeerCasa('casa-collin-alarm', 'Texecom Alarm Casa',
                            { hostname: 'collin.viewcam.me', port: 10002 },
                            internetCasa, home, false, internet, {});

var cctvCasa = new PeerCasa('casa-collin-cctv', 'CCTV Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10003 }, 
                            internetCasa, home, false, internet, {});

var lightCasa = new PeerCasa('casa-collin-light', 'Light Peer Casa',
                            { hostname: 'collin.viewcam.me', port: 10004 },
                            internetCasa,  home, false, internet, {});

//////////////////////////////////////////////////////////////////
// States
//////////////////////////////////////////////////////////////////
var weatherWetState = new State('weather-state', internetCasa);

//////////////////////////////////////////////////////////////////
// Activators
//////////////////////////////////////////////////////////////////
var alarmCasaActivator = new Activator('alarm-casa-casa', alarmCasa, 0, false);

//////////////////////////////////////////////////////////////////
// Actions
//////////////////////////////////////////////////////////////////
var alarmCasaMessage = new PushoverAction('internet-parent',
                                          'Security-Info: Connected to Internet!', 0,
                                          'Security-Info: Internet connection lost!', 2, 
                                          alarmCasaActivator, admins);

setTimeout(function() {
   weatherWetState.emit('active', weatherWetState.name);
   setTimeout(function() {
      weatherWetState.emit('inactive', weatherWetState.name);
   }, 10000);
}, 10000);
