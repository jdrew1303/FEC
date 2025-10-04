var stream = require('stream');
var util = require('util');

// List and load all the methods which contain the encode/decode transforms
var methods = {
  hamming84: 'Hamming(8,4)',
  reedsolomon: 'Reed-Solomon'
};
var transforms = {};
transforms[methods.hamming84] = require('./methods/hamming84');
transforms[methods.reedsolomon] = require('./methods/reedsolomon');

// Use a transform stream to encode/decode data
var Transform = stream.Transform || require('readable-stream').Transform;

/**
 * Encodes data using the encode function from the method of your choice
 * @param options
 * @returns {Encoder}
 * @constructor
 */
var Encoder = function(options) {
  if (!(this instanceof Encoder)) {
    return new Encoder(options);
  }

  Transform.call(this, options);
  options = options || {};
  this.method = options.method || methods.hamming84;

	if (typeof transforms[this.method].initEncoder == 'function') {
		transforms[this.method].initEncoder.call(this, options);
	}

};

util.inherits(Encoder, Transform);

Encoder.prototype._transform = function(data, encoding, done) {
  transforms[this.method].encode.call(this, data, encoding, done);
};

Encoder.prototype._flush = function(done) {
  if (typeof transforms[this.method].flushEncoder == 'function') {
    transforms[this.method].flushEncoder.call(this, done);
  } else {
    done();
  }
};

/**
 * Decodes data using the decode function from the method of your choice
 * @param options
 * @returns {Decoder}
 * @constructor
 */
var Decoder = function(options) {
  if (!(this instanceof Decoder)) {
    return new Decoder(options);
  }

  Transform.call(this, options);
  options = options || {};
  this.method = options.method || methods.hamming84;

	if (typeof transforms[this.method].initDecoder == 'function') {
		transforms[this.method].initDecoder.call(this, options);
	}
};

util.inherits(Decoder, Transform);

Decoder.prototype._transform = function(data, encoding, done) {
  transforms[this.method].decode.call(this, data, encoding, done);
};

Decoder.prototype._flush = function(done) {
  if (typeof transforms[this.method].flushDecoder == 'function') {
    transforms[this.method].flushDecoder.call(this, done);
  } else {
    done();
  }
};

var erasure = module.exports = {
  version: '1.0.0',
  Encoder: Encoder,
  Decoder: Decoder,
  methods: methods
};
