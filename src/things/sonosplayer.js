var util = require('util');
var Thing = require('../thing');
var Sonos = require('sonos');

function SonosPlayer(_config) {
   Thing.call(this, _config);

   this.zone = _config.zone;
   this.host = _config.host;
   this.port = _config.port;
   this.alarmUrls = {};
   this.alarmRepeatTimes = {};
   this.alarmVolumes = {};
   this.inAlarmStatus = false;
   this.devices = [];

   this.ensurePropertyExists('volume', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('volume-writable', 'property', { initialValue: 0 }, _config);
   this.ensurePropertyExists('muted', 'property', { initialValue: false }, _config);
   this.ensurePropertyExists('playing', 'property', { initialValue: false }, _config);
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
}

util.inherits(SonosPlayer, Thing);

SonosPlayer.prototype.coldStart = function() {

   if (this.host) {
      this.createDevice({ host: this.host, port: this.port });
      this.sonos = this.devices[0].sonos;
   }
   else {
      this.sonosService = this.gang.findService("service:sonos");

      if (!this.sonosService) {
         console.error(this.uName + ": ***** Sonos service not found! *************");
         process.exit(1);
      }

      this.sonosService.registerForHostForZone(this.zone, (_err, _device) => {

         if (!_err) {
            this.createDevice(_device);
         }
         else {
            this.deviceNotAvailable();
         }
      });
   }

   Thing.prototype.coldStart.call(this);
};

SonosPlayer.prototype.deviceNotAvailable = function(_device) {

   if (this.device) {
      this.sonos.removeAllListeners('AVTransport');
      this.sonos.removeAllListeners('PlayState');
      this.sonos.removeAllListeners('Muted');
      this.sonos.close();
      this.sonos = null;
      this.device = null;
   }
};

SonosPlayer.prototype.createDevice = function(_device) {
   this.alignPropertyValue('ACTIVE', true);
   console.log(this.uName + ": Successfully attached to sonos device in zone " + this.zone + ", host=" + _device.host);
   this.device = _device;

   this.notifications = {};
   this.sonos = new Sonos.Sonos(this.device.host, this.device.port);
   this.startSyncingStatus();
};

SonosPlayer.prototype.startSyncingStatus = function() {

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

SonosPlayer.prototype.processMuteEvent = function(_muted) {
   console.log(this.uName + ": processMuteEvent() muted=",_muted);
   this.alignPropertyValue('muted', _muted);
};

SonosPlayer.prototype.processAVTransportChange = function(_data) {
   //console.log(this.uName + ": processAVTransportChange() data=",_data);
};

SonosPlayer.prototype.processPlayState = function(_data) {
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

SonosPlayer.prototype.propertyAboutToChange = function(_propName, _propValue, _data) {

   if (this.sonos && _data.alignWithParent && (this.getProperty(_propName) !== _propValue)) {

      switch (_propName) {
      case "volume": 
         this.setVolume(_propValue);
         break;

      case "muted": 
         this.setMuted(_propValue);
         break;

      case "playing":
         (_propValue) ? this.play() : this.pause();
         break;

      case "current-track":
         this.play(_propValue);
         break;

      case "fire-alarm":
      case "alarm":
         this.alarm(_propName, _propValue);
         break;

      default:
      }
   }
};

SonosPlayer.prototype.setVolume = function(_level) {

   this.sonos.setVolume(_level).catch(_error => {
      console.log(this.uName + ": Unable to set Volume!");
   });
};

SonosPlayer.prototype.setMuted = function(_muted) {

   this.sonos.setMuted(_muted).catch(_error => {
      console.log(this.uName + ": Unable to set mute!");
   });
};

SonosPlayer.prototype.pause = function() {

   this.sonos.pause().catch(_error => {
      console.log(this.uName + ": Unable to pause!");
   });
};

SonosPlayer.prototype.play = function(_url) {

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

SonosPlayer.prototype.playNext = function(_stopIfFail) {

   this.sonos.next().catch(_error => {
      console.error(this.uName + ": Unable to play next track!");

      if (_stopIfFail) {
         this.stop();
      }
   });
};

SonosPlayer.prototype.stop = function() {

   this.sonos.stop().catch(_error => {
      console.log(this.uName + ": Unable to stop music from playing!");
   });
};

SonosPlayer.prototype.saveCurrentState = function(_property) {
   this.savedStatus = { volume: this.props['volume'].value,
                        muted: this.props['muted'].value,
                        playing: this.props['playing'].value };

   if (this.getProperty("muted")) {
      this.alignPropertyValue("muted", false);
   }

   this.alignPropertyValue("volume", this.alarmVolumes[_property]);
};

SonosPlayer.prototype.restoreSavedState = function() {

   if (this.props['volume'].value !== this.savedStatus.volume) {
      this.alignPropertyValue("volume", this.savedStatus.volume);
   }

   if (this.props['muted'].value !== this.savedStatus.muted) {
      this.alignPropertyValue("muted", this.savedStatus.muted);
   }

   if (this.savedStatus.playing) {
      this.playNext(true);
   }
   else {
      this.stop();
   }
};

SonosPlayer.prototype.alarm = function(_propName, _propValue) {

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

SonosPlayer.prototype.replayAfterTimeout = function(_url, _timeout) {

   this.repeatTimer = setTimeout( () => {

      if (_this.inAlarmStatus) {

         this.sonos.play(_url).then( () => {
            this.replayAfterTimeout(_url, _timeout);
         }).catch(_error => {
            console.log(_this.uName + ": Unable to replay alarm sound");
         });

      }
   }, _timeout);
};

module.exports = exports = SonosPlayer;
