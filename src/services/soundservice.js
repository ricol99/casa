var util = require('util');
var Service = require('../service');
var audio = require('osx-audio');
var AudioAnalyser = require('audio-analyser');

function SoundService(_config, _owner) {
   Service.call(this, _config, _owner);
}

util.inherits(SoundService, Service);

SoundService.prototype.startAnalysing = function() {

   var Generator = require('audio-generator/stream');

   var sinewaveGen = function(_time) {
      return [ Math.sin(Math.PI * 2 * _time * 3000) ]
   }

   Generator(sinewaveGen, { duration: Infinity, period: Infinity })
   .pipe(this.analyser);
   //this.input.pipe(this.analyser);
};

SoundService.prototype.coldStart = function() {
   this.input = new audio.Input();

   this.analyser = new AudioAnalyser({
      // Magnitude diapasone, in dB 
      minDecibels: -100,
      maxDecibels: -30,
 
      // Number of time samples to transform to frequency 
      fftSize: 1024,
 
      // Number of frequencies, twice less than fftSize 
      frequencyBinCount: 1024/2,

      // Smoothing, or the priority of the old data over the new data 
      smoothingTimeConstant: 0.2,

      // Number of channel to analyse 
      channel: 0,

      // Size of time data to buffer 
      bufferSize: 44100,

      // Windowing function for fft, https://github.com/scijs/window-functions 
      //applyWindow: function (_sampleNumber, _totalSamples) {
         //console.log("AAAAAAAA SampleNumber="+_sampleNumber+" TotalSamples="+_totalSamples);
      //}

      //...pcm-stream params, if required 
   });

   this.startAnalysing();

   var dataArray = new Uint8Array(this.analyser.frequencyBinCount); // Uint8Array should be the same length as the frequencyBinCount 

   setInterval( () => {
      this.analyser.getByteFrequencyData(dataArray);
      //console.log(dataArray);
      if (dataArray[68] > 150) 
         console.log(dataArray[68]);
   }, 500);
};

module.exports = exports = SoundService;
