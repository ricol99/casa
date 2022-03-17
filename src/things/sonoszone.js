var util = require('util');
var Thing = require('../thing');
const { Sonos } = require('sonos');

function SonosZone(_config, _parent) {
   Thing.call(this, _config, _parent);

   this.zone = _config.zone;
   this.host = null;
   this.port = null;
   this.alarmUrls = {};
   this.alarmRepeatTimes = {};
   this.alarmVolumes = {};
   this.inAlarmStatus = false;
   this.devices = [];

   this.ensurePropertyExists('ACTIVE', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('volume', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('volume-writable', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('muted', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('playing', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('current-playlist', 'property', { initialValue: "" }, _config);
   this.ensurePropertyExists('current-track', 'property', { initialValue: "" }, _config);
   this.ensurePropertyExists('play-mode', 'property', { initialValue: "" }, _config);

   if (_config.alarmUrl) {
      this.alarmUrls['alarm'] = _config.alarmUrl;
      this.alarmRepeatTimes['alarm'] = _config.alarmRepeatTime;
      this.alarmVolumes['alarm'] = _config.hasOwnProperty("alarmVolume") ? _config.alarmVolume : 60;
      this.ensurePropertyExists('alarm', 'property', { initialValue: false }, _config);
   }

   if (_config.fireAlarmUrl) {
      this.alarmUrls['fire-alarm'] = _config.fireAlarmUrl;
      this.alarmRepeatTimes['fire-alarm'] = _config.fireAlarmRepeatTime;
      this.alarmVolumes['fire-alarm'] = _config.hasOwnProperty("fireAlarmVolume") ? _config.fireAlarmVolume : 60;
      this.ensurePropertyExists('fire-alarm', 'property', { initialValue: false }, _config);
   }

   this.service = (_config.hasOwnProperty("service")) ? _config.service : "sonosservice";

   if (_config.hasOwnProperty("service")) {
      this.serviceName = _config.service+":"+this.zone.replace(/ /g, "-");
   }
   else {
      var service =  this.gang.casa.findService("sonosservice");

      if (!service) {
         console.error(this.uName + ": ***** Sonos service not found! *************");
         process.exit();
      }

      this.serviceName = service.uName+":"+this.zone.replace(/ /g, "-");
   }

   this.ensurePropertyExists('host', 'property', { initialValue: null, source: { uName: this.serviceName, property: "host" }}, _config);
   this.ensurePropertyExists('port', 'property', { initialValue: null, source: { uName: this.serviceName, property: "port" }}, _config);
}

util.inherits(SonosZone, Thing);

SonosZone.prototype.closeConnectionToDevice = function() {

   if (this.connected) {
      this.sonos.removeAllListeners('AVTransport');
      this.sonos.removeAllListeners('PlayState');
      this.sonos.removeAllListeners('Muted');
      this.sonos.close();
      this.sonos = null;
      this.connected = false;
   }
};

SonosZone.prototype.createDevice = function() {

   try {
      this.sonos = new Sonos(this.host, this.port);
      this.connected = true;
      console.log(this.uName + ": Successfully attached to sonos device in zone " + this.zone + ", host=" + this.host);
      this.notifications = {};
      this.alignPropertyValue('ACTIVE', true);
      this.startSyncingStatus();
   }
   catch (_error) {
      console.error(this.uName + ": Unable to connect to sonos zone coordinator");
   }
};

SonosZone.prototype.startSyncingStatus = function() {

   this.sonos.on('AVTransport', _event => {
      console.log('AVTransport event=', _event)
      this.processAVTransportChange(_event);
   });

   this.sonos.on('PlayState', _event => {
      console.log('Play state event=', _event)
      this.processPlayState(_event);
   });

   this.sonos.on('Muted', _event => {
      console.log('Mute state event=', _event)
      this.processMuteEvent(_event);
   });
};

SonosZone.prototype.processMuteEvent = function(_muted) {
   console.log(this.uName + ": processMuteEvent() muted=",_muted);
   this.alignPropertyValue('muted', _muted);
};

SonosZone.prototype.processAVTransportChange = function(_data) {
   //console.log(this.uName + ": processAVTransportChange() data=",_data);
};

SonosZone.prototype.processPlayState = function(_data) {
   console.log(this.uName + ": processPlayState() data=",_data);

   switch(_data) {
      case 'playing':
         this.alignPropertyValue('playing', true);
         break;
      case 'paused':
         this.alignPropertyValue('playing', false);
         break;
   }
};

SonosZone.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (_data.alignWithParent && (this.getProperty(_propName) !== _propValue)) {

      switch (_propName) {
      case "host":
         this.host = _propValue;

      case "port":
         if (_propName === "port") {
            this.port = _propValue;
         }

         if (this.connected) {
            this.closeConnectionToDevice();
         }

         setTimeout(() => {
            this.createDevice();
         }, 3000);
         break;

      case "volume": 
         if (this.connected) {
            this.setVolume(_propValue);
         }
         break;

      case "muted": 
         if (this.connected) {
            this.setMuted(_propValue);
         }
         break;

      case "playing":
         if (this.connected) {
            (_propValue) ? this.play() : this.pause();
         }
         break;

      case "current-track":
         if (this.connected) {
            this.play(_propValue);
         }
         break;

      case "current-playlist":
         if (this.connected) {
            this.playPlaylist(_propValue);
         }
         break;

      case "fire-alarm":
      case "alarm":
         if (this.connected) {
            this.alarm(_propName, _propValue);
         }
         break;

      default:
      }
   }
};

SonosZone.prototype.setVolume = function(_level) {

   this.sonos.setVolume(_level).catch(_error => {
      console.log(this.uName + ": Unable to set Volume!");
   });
};

SonosZone.prototype.setMuted = function(_muted) {

   this.sonos.setMuted(_muted).catch(_error => {
      console.log(this.uName + ": Unable to set mute!");
   });
};

SonosZone.prototype.pause = function() {

   this.sonos.pause().catch(_error => {
      console.log(this.uName + ": Unable to pause!");
   });
};

SonosZone.prototype.play = function(_url) {

   if (_url) {
      this.sonos.play(_url).catch(_error => {
         console.error(this.uName + ": Unable to play "+_url+"!");
      });
   }
   else {
      this.sonos.play().catch(_error => {
         console.error(this.uName + ": Unable to play!");
      });
   }
};

SonosZone.prototype.playPlaylist = function(_playlistName) {
   console.log(this.uName + ": About to play playlist "+_playlistName);

   this.sonos.getMusicLibrary('sonos_playlists').then(_playlists => {
      var uri = null;

      for (var i = 0; i < _playlists.items.length; ++i) {

         if (_playlists.items[i].title === _playlistName) {
            uri = _playlists.items[i].uri;
            break;
         }
      }

      if (uri) {
         this.sonos.play(uri).catch(_error => {
            console.error(this.uName + ": Unable to play "+uri+"!");
         });
      }
   });
};

SonosZone.prototype.playNext = function(_stopIfFail) {

   this.sonos.next().catch(_error => {
      console.error(this.uName + ": Unable to play next track!");

      if (_stopIfFail) {
         this.stop();
      }
   });
};

SonosZone.prototype.stop = function() {

   this.sonos.stop().catch(_error => {
      console.log(this.uName + ": Unable to stop music from playing!");
   });
};

SonosZone.prototype.saveCurrentState = function(_property) {
   this.savedStatus = { volume: this.properties['volume'].value,
                        muted: this.properties['muted'].value,
                        playing: this.properties['playing'].value };

   if (this.getProperty("muted")) {
      this.alignPropertyValue("muted", false);
   }

   this.alignPropertyValue("volume", this.alarmVolumes[_property]);
};

SonosZone.prototype.restoreSavedState = function() {

   if (this.properties['volume'].value !== this.savedStatus.volume) {
      this.alignPropertyValue("volume", this.savedStatus.volume);
   }

   if (this.properties['muted'].value !== this.savedStatus.muted) {
      this.alignPropertyValue("muted", this.savedStatus.muted);
   }

   if (this.savedStatus.playing) {
      this.playNext(true);
   }
   else {
      this.stop();
   }
};

SonosZone.prototype.alarm = function(_propName, _propValue) {

   if (this.inAlarmStatus === _propValue) {
      return;
   }

   this.inAlarmStatus = _propValue;

   if (_propValue) {
      this.saveCurrentState(_propName);
      this.play(this.alarmUrls[_propName]);
      this.replayAfterTimeout(this.alarmUrls[_propName], this.alarmRepeatTimes[_propName]);
   }
   else {
      clearTimeout(this.repeatTimer);
      this.restoreSavedState();
   }
};

SonosZone.prototype.replayAfterTimeout = function(_url, _timeout) {

   this.repeatTimer = setTimeout( () => {

      if (this.inAlarmStatus) {

         this.sonos.play(_url).then( () => {
            this.replayAfterTimeout(_url, _timeout);
         }).catch(_error => {
            console.log(this.uName + ": Unable to replay alarm sound");
         });

      }
   }, _timeout);
};

module.exports = exports = SonosZone;
