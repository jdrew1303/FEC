/**
 * Reed-Solomon
 *
 * This method uses the Reed-Solomon error correction algorithm to encode and decode data.
 * It is capable of correcting multiple errors in the data.
 */

var rs = require('../reedsolomon.js');

/**
 * Initializes the encoder.
 * This function is called by the Encoder constructor.
 * @param {object} options - The options for the encoder.
 * @param {number} options.ecclen - The number of error correction bytes. Defaults to 32.
 */
var initEncoder = function(options) {
  options = options || {};
  this.ecclen = options.ecclen || 32;
  this.dataLen = 255 - this.ecclen;
  this.buffer = Buffer.alloc(0);
  this.encoder = new rs.ReedSolomonEncoder(rs.GenericGF.DATA_MATRIX_FIELD_256());
};

/**
 * The _transform method for encoding a stream using Reed-Solomon.
 * @param {Buffer|string} data - The data to encode.
 * @param {string} encoding - The encoding of the data.
 * @param {function} done - The callback to call when encoding is complete.
 */
var encode = function(data, encoding, done) {
  var inBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
  this.buffer = Buffer.concat([this.buffer, inBuffer]);

  while (this.buffer.length >= this.dataLen) {
    var block = this.buffer.slice(0, this.dataLen);
    this.buffer = this.buffer.slice(this.dataLen);

    var toEncode = Buffer.concat([block, Buffer.alloc(this.ecclen)], 255);
    this.encoder.encode(toEncode, this.ecclen);
    this.push(toEncode);
  }

  done();
};

/**
 * This function is called when the stream is flushed.
 * It encodes any remaining data in the buffer.
 * @param {function} done - The callback to call when flushing is complete.
 */
var flushEncoder = function(done) {
    if (this.buffer.length > 0) {
        var block = this.buffer;
        var toEncode = Buffer.alloc(255);
        block.copy(toEncode);
        this.encoder.encode(toEncode, this.ecclen);
        var data = toEncode.slice(0, block.length);
        var ecc = toEncode.slice(255 - this.ecclen);
        this.push(Buffer.concat([data, ecc]));
    }
    done();
};

/**
 * Initializes the decoder.
 * This function is called by the Decoder constructor.
 * @param {object} options - The options for the decoder.
 * @param {number} options.ecclen - The number of error correction bytes. Defaults to 32.
 */
var initDecoder = function(options) {
  options = options || {};
  this.ecclen = options.ecclen || 32;
  this.msgLen = 255;
  this.buffer = Buffer.alloc(0);
  this.decoder = new rs.ReedSolomonDecoder(rs.GenericGF.DATA_MATRIX_FIELD_256());
};

/**
 * The _transform method for decoding a stream using Reed-Solomon.
 * @param {Buffer|string} data - The data to decode.
 * @param {string} encoding - The encoding of the data.
 * @param {function} done - The callback to call when decoding is complete.
 */
var decode = function(data, encoding, done) {
  var inBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
  this.buffer = Buffer.concat([this.buffer, inBuffer]);

  while (this.buffer.length >= this.msgLen) {
    var block = this.buffer.slice(0, this.msgLen);
    this.buffer = this.buffer.slice(this.msgLen);

    try {
      this.decoder.decode(block, this.ecclen);
      this.push(block.slice(0, this.msgLen - this.ecclen));
    } catch (e) {
      // Error in decoding, emit an error
      this.emit('error', e);
    }
  }

  done();
};

/**
 * This function is called when the stream is flushed.
 * It decodes any remaining data in the buffer.
 * @param {function} done - The callback to call when flushing is complete.
 */
var flushDecoder = function(done) {
    if (this.buffer.length > 0) {
        var received = this.buffer;
        var dataLen = received.length - this.ecclen;
        var data = received.slice(0, dataLen);
        var ecc = received.slice(dataLen);

        var toDecode = Buffer.alloc(255);
        data.copy(toDecode);
        ecc.copy(toDecode, 255 - this.ecclen);

        try {
            this.decoder.decode(toDecode, this.ecclen);
            this.push(toDecode.slice(0, dataLen));
        } catch (e) {
            this.emit('error', e);
        }
    }
    done();
};

module.exports = {
  initEncoder: initEncoder,
  encode: encode,
  flushEncoder: flushEncoder,
  initDecoder: initDecoder,
  decode: decode,
  flushDecoder: flushDecoder
};