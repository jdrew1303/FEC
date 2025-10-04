var should = require('should');
var fec = require('../lib/fec');
var fs = require('fs');
var path = require('path');
var diff = require('diff');
var stream = require('stream');

/**
 * Helper function to return the absolute path of a file in the test dir
 * @param file
 */
var getFilePath = function(file) {
  return path.join(__dirname, file);
};

/**
 * Helper function to test that files are equal
 */
var testFilesEqual = function(f1, f2, done) {
  fs.readFile(getFilePath(f1), function(err, original) {
    should(err).not.be.ok;
    fs.readFile(getFilePath(f2), function(err, recovered) {
      should(err).not.be.ok;
      if (original.toString() !== recovered.toString()) {
        console.log(diff.createPatch(f1, original.toString(), recovered.toString()));
      }
      original.toString().should.equal(recovered.toString());
      done();
    });
  });
};

describe('fec.Encoder() -- RaptorQ', function() {
  it('should encode a small file', function(done) {
    var encoder = new fec.Encoder({ method: fec.methods.raptor });
    fs.createReadStream(getFilePath('test.txt'))
      .pipe(encoder)
      .pipe(fs.createWriteStream(getFilePath('./test.raptor.out')))
      .on('finish', function() {
        done();
      });
  });

  it('should encode a large file', function(done) {
    this.timeout(5000); // Increase timeout for larger file
    var encoder = new fec.Encoder({ method: fec.methods.raptor });
    fs.createReadStream(getFilePath('popsci1900.txt'))
      .pipe(encoder)
      .pipe(fs.createWriteStream(getFilePath('popsci1900.raptor.out')))
      .on('finish', function() {
        done();
      });
  });
});

describe('fec.Decoder() -- RaptorQ', function() {
  it('should decode a small file', function(done) {
    var decoder = new fec.Decoder({ method: fec.methods.raptor });
    fs.createReadStream(getFilePath('./test.raptor.out'))
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('./test.raptor.out.txt')))
      .on('finish', function() {
        testFilesEqual('test.txt', 'test.raptor.out.txt', done);
      });
  });

  it('should decode a large file', function(done) {
    this.timeout(5000); // Increase timeout for larger file
    var decoder = new fec.Decoder({ method: fec.methods.raptor });
    fs.createReadStream(getFilePath('popsci1900.raptor.out'))
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('popsci1900.raptor.out.txt')))
      .on('finish', function() {
        testFilesEqual('popsci1900.txt', 'popsci1900.raptor.out.txt', done);
      });
  });

  it('should handle packet loss for a small file', function(done) {
    this.timeout(5000);
    const overhead = 0.5; // 50% overhead, should be enough to cover 30% loss
    const drop_rate = 0.3; // drop 30% of packets
    const fileIn = getFilePath('test.txt');
    const fileOut = getFilePath('test.raptor.corrupt.out.txt');

    // 1. Encode the file
    var encoder = new fec.Encoder({
      method: fec.methods.raptor,
      overhead: overhead
    });
    var encodeStream = fs.createReadStream(fileIn).pipe(encoder);

    // 2. Collect encoded data and simulate loss
    var chunks = [];
    encodeStream.on('data', (chunk) => chunks.push(chunk));
    encodeStream.on('end', () => {
      let buffer = Buffer.concat(chunks);

      // Reconstruct packets from the stream
      const headerLen = buffer.readUInt32BE(0);
      const header = buffer.slice(0, 4 + headerLen);
      buffer = buffer.slice(4 + headerLen);

      let packets = [];
      while(buffer.length > 0) {
        const packetLen = buffer.readUInt32BE(0);
        const packet = buffer.slice(0, 4 + packetLen);
        packets.push(packet);
        buffer = buffer.slice(4 + packetLen);
      }

      const originalPacketCount = packets.length;
      packets = packets.filter(() => Math.random() > drop_rate);
      console.log(`Dropped ${originalPacketCount - packets.length} of ${originalPacketCount} packets.`);

      const corruptStream = new stream.PassThrough();
      corruptStream.write(header);
      packets.forEach(p => corruptStream.write(p));
      corruptStream.end();

      // 3. Decode the corrupted stream
      var decoder = new fec.Decoder({ method: fec.methods.raptor });
      decoder.on('error', done); // Fail test on decoding error

      corruptStream
        .pipe(decoder)
        .pipe(fs.createWriteStream(fileOut))
        .on('finish', () => {
          testFilesEqual('test.txt', 'test.raptor.corrupt.out.txt', done);
        });
    });
  });

  it('should encode and decode a single byte file', function(done) {
    var encoder = new fec.Encoder({ method: fec.methods.raptor });
    var decoder = new fec.Decoder({ method: fec.methods.raptor });

    fs.createReadStream(getFilePath('single_byte.txt'))
      .pipe(encoder)
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('./single_byte.raptor.out.txt')))
      .on('finish', function() {
        testFilesEqual('single_byte.txt', 'single_byte.raptor.out.txt', done);
      });
  });
});