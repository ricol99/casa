function GangCasaAddress(_config) {
   this.scheme = "gang-casa";
   this.gang = null;
   this.casa = null;

   if (typeof _config === "string") {
      this.importString(_config);
   }
   else {
      this.import(_config);
   }
}

GangCasaAddress.prototype.import = function(_config) {

   if (!_config || !_config.gang || !_config.casa) {
      throw new Error("GangCasaAddress requires gang and casa");
   }

   if (typeof _config.gang !== "string") {
      throw new Error("GangCasaAddress gang must be a string");
   }

   if (typeof _config.casa !== "string") {
      throw new Error("GangCasaAddress casa must be a string");
   }

   if (_config.gang.length === 0) {
      throw new Error("GangCasaAddress gang must not be empty");
   }

   if (_config.casa.length === 0) {
      throw new Error("GangCasaAddress casa must not be empty");
   }

   if (_config.casa[0] !== ":") {
      throw new Error("GangCasaAddress casa must start with ':'");
   }

   this.gang = _config.gang;
   this.casa = _config.casa;
};

GangCasaAddress.prototype.importString = function(_address) {

   if (typeof _address !== "string") {
      throw new Error("GangCasaAddress string address must be a string");
   }

   if (_address.indexOf("gang-casa://") !== 0) {
      throw new Error("GangCasaAddress only supports gang-casa:// addresses");
   }

   var remainder = _address.substring("gang-casa://".length);
   var slashIndex = remainder.indexOf("/");

   if (slashIndex <= 0) {
      throw new Error("GangCasaAddress string address requires gang and casa");
   }

   var encodedGang = remainder.substring(0, slashIndex);
   var encodedCasa = remainder.substring(slashIndex + 1);

   if (encodedCasa.length === 0) {
      throw new Error("GangCasaAddress string address requires casa");
   }

   this.import({
      gang: this.decodeAddressPart(encodedGang),
      casa: this.decodeAddressPart(encodedCasa)
   });
};

GangCasaAddress.prototype.encodeAddressPart = function(_value) {
   return encodeURIComponent(_value).replace(/%3A/g, ":");
};

GangCasaAddress.prototype.decodeAddressPart = function(_value) {

   try {
      return decodeURIComponent(_value);
   }
   catch (_error) {
      throw new Error("GangCasaAddress contains invalid URI encoding");
   }
};

GangCasaAddress.prototype.toString = function() {
   this.import({ gang: this.gang, casa: this.casa });
   return "gang-casa://" + this.encodeAddressPart(this.gang) + "/" + this.encodeAddressPart(this.casa);
};

GangCasaAddress.prototype.export = function() {
   return {
      gang: this.gang,
      casa: this.casa
   };
};

GangCasaAddress.fromString = function(_address) {
   return new GangCasaAddress(_address);
};

module.exports = exports = GangCasaAddress;
