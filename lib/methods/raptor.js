/**
 * RaptorQ
 *
 * This method uses the RaptorQ error correction algorithm (RFC 6330).
 * It is a fountain code, capable of generating a large number of repair symbols.
 */

const { raptorq_raw } = require('@davidcal/fec-raptorq');

/**
 * Initializes the encoder.
 * @param {object} options - The options for the encoder.
 * @param {number} options.overhead - Redundancy factor (e.g., 0.2 for 20% overhead). Defaults to 0.2.
 * @param {number} options.symbol_size - Size of each symbol in bytes. Defaults to 1400.
 */
var initEncoder = function(options) {
  options = options || {};
  this.overhead = options.overhead || 0.2;
  this.symbol_size = BigInt(options.symbol_size || 1400);
  this.buffer = Buffer.alloc(0);
};

/**
 * The _transform method for encoding. It just buffers the data.
 * @param {Buffer|string} data - The data to encode.
 * @param {string} encoding - The encoding of the data.
 * @param {function} done - The callback to call when buffering is complete.
 */
var encode = function(data, encoding, done) {
  var inBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
  this.buffer = Buffer.concat([this.buffer, inBuffer]);
  done();
};

/**
 * This function is called when the stream is flushed.
 * It encodes the buffered data and pushes encoding packets.
 * @param {function} done - The callback to call when flushing is complete.
 */
var flushEncoder = async function(done) {
  if (this.buffer.length > 0) {
    try {
        const data = new Uint8Array(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);

        const transfer_length = BigInt(data.length);
        let symbol_size = this.symbol_size;
        if (transfer_length > 0n && transfer_length < symbol_size) {
            symbol_size = transfer_length;
        }

        const bigint_ceil = (a, b) => (a + b - 1n) / b;
        const num_source_symbols = transfer_length > 0n ? bigint_ceil(transfer_length, symbol_size) : 0n;
        const num_repair_symbols = num_source_symbols > 0n ? BigInt(Math.ceil(Number(num_source_symbols) * this.overhead)) : 0n;

        const encode_options = {
            symbol_size: symbol_size,
            num_repair_symbols: num_repair_symbols,
            num_source_blocks: 1n,
            num_sub_blocks: 1n,
            symbol_alignment: 1n,
        };

        const result = raptorq_raw.encode({ options: encode_options, data: data });

        const oti_bytes = await result.oti;

        const header = {
          oti: Buffer.from(oti_bytes).toString('hex')
        };
        const headerBuffer = Buffer.from(JSON.stringify(header));
        const headerLengthBuffer = Buffer.alloc(4);
        headerLengthBuffer.writeUInt32BE(headerBuffer.length, 0);

        this.push(headerLengthBuffer);
        this.push(headerBuffer);

        for await (const packet of result.encoding_packets) {
            const packetLengthBuffer = Buffer.alloc(4);
            packetLengthBuffer.writeUInt32BE(packet.length, 0);
            this.push(packetLengthBuffer);
            this.push(Buffer.from(packet));
        }

    } catch(e) {
        this.emit('error', e);
    }
  }
  done();
};

/**
 * Initializes the decoder.
 * @param {object} options - The options for the decoder.
 */
var initDecoder = function(options) {
  this.buffer = Buffer.alloc(0);
};

/**
 * The _transform method for decoding a stream. It just buffers the data.
 * @param {Buffer|string} data - The data to decode.
 * @param {string} encoding - The encoding of the data.
 * @param {function} done - The callback to call when decoding is complete.
 */
var decode = function(data, encoding, done) {
    var inBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
    this.buffer = Buffer.concat([this.buffer, inBuffer]);
    done();
};

/**
 * This function is called when the stream is flushed.
 * It decodes the buffered data.
 * @param {function} done - The callback to call when flushing is complete.
 */
var flushDecoder = async function(done) {
    if (this.buffer.length === 0) {
        return done();
    }

    try {
        let header_len = null;
        if (this.buffer.length >= 4) {
            header_len = this.buffer.readUInt32BE(0);
            this.buffer = this.buffer.slice(4);
        } else {
            this.emit('error', new Error('Incomplete stream, not enough data for header length.'));
            return done();
        }

        if (this.buffer.length < header_len) {
            this.emit('error', new Error('Incomplete stream, not enough data for header.'));
            return done();
        }

        const headerBuffer = this.buffer.slice(0, header_len);
        this.buffer = this.buffer.slice(header_len);
        const header = JSON.parse(headerBuffer.toString());
        const oti_bytes = new Uint8Array(Buffer.from(header.oti, 'hex'));

        const encoding_packets_iterator = (async function* (buffer) {
            let current_buffer = buffer;
            while (current_buffer.length > 4) {
                const packetLen = current_buffer.readUInt32BE(0);
                if (current_buffer.length >= 4 + packetLen) {
                    const packet = current_buffer.slice(4, 4 + packetLen);
                    yield new Uint8Array(packet.buffer, packet.byteOffset, packet.byteLength);
                    current_buffer = current_buffer.slice(4 + packetLen);
                } else {
                    break;
                }
            }
        })(this.buffer);

        const decoded_data = await raptorq_raw.decode({
            oti: oti_bytes,
            encoding_packets: encoding_packets_iterator,
        });

        this.push(Buffer.from(decoded_data));

    } catch (e) {
        this.emit('error', e);
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