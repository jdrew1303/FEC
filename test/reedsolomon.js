var should = require('should');
var fec = require('../lib/fec');
var fs = require('fs');
var path = require('path');
var diff = require('diff');

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

describe('fec.Encoder() -- Reed-Solomon', function() {
  it('should encode a small file', function(done) {
    var encoder = new fec.Encoder({ method: fec.methods.reedsolomon, ecclen: 10 });
    fs.createReadStream(getFilePath('test.txt'))
      .pipe(encoder)
      .pipe(fs.createWriteStream(getFilePath('./test.rs.out')))
      .on('finish', function() {
        done();
      });
  });

  it('should encode a large file', function(done) {
    this.timeout(5000); // Increase timeout for larger file
    var encoder = new fec.Encoder({ method: fec.methods.reedsolomon, ecclen: 32 });
    fs.createReadStream(getFilePath('popsci1900.txt'))
      .pipe(encoder)
      .pipe(fs.createWriteStream(getFilePath('popsci1900.rs.out')))
      .on('finish', function() {
        done();
      });
  });
});

describe('fec.Decoder() -- Reed-Solomon', function() {
  it('should decode a small file', function(done) {
    var decoder = new fec.Decoder({ method: fec.methods.reedsolomon, ecclen: 10 });
    fs.createReadStream(getFilePath('./test.rs.out'))
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('./test.rs.out.txt')))
      .on('finish', function() {
        testFilesEqual('test.txt', 'test.rs.out.txt', done);
      });
  });

  it('should decode a large file', function(done) {
    this.timeout(5000); // Increase timeout for larger file
    var decoder = new fec.Decoder({ method: fec.methods.reedsolomon, ecclen: 32 });
    fs.createReadStream(getFilePath('popsci1900.rs.out'))
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('popsci1900.rs.out.txt')))
      .on('finish', function() {
        testFilesEqual('popsci1900.txt', 'popsci1900.rs.out.txt', done);
      });
  });

  it('should correct errors in a small file', function(done) {
    var ecclen = 10;

    // Corrupt the file
    var encoded = fs.readFileSync(getFilePath('./test.rs.out'));
    var numErrors = Math.floor(ecclen / 2);
    for (var i = 0; i < numErrors; i++) {
        encoded[i] = encoded[i] ^ 0xff; // Flip some bits
    }
    fs.writeFileSync(getFilePath('./test.rs.corrupt.out'), encoded);

    var decoder = new fec.Decoder({ method: fec.methods.reedsolomon, ecclen: ecclen });
    fs.createReadStream(getFilePath('./test.rs.corrupt.out'))
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('./test.rs.corrupt.out.txt')))
      .on('finish', function() {
        testFilesEqual('test.txt', 'test.rs.corrupt.out.txt', done);
      });
  });

  it('should encode and decode a single byte file', function(done) {
    var encoder = new fec.Encoder({ method: fec.methods.reedsolomon, ecclen: 10 });
    var decoder = new fec.Decoder({ method: fec.methods.reedsolomon, ecclen: 10 });

    fs.createReadStream(getFilePath('single_byte.txt'))
      .pipe(encoder)
      .pipe(decoder)
      .pipe(fs.createWriteStream(getFilePath('./single_byte.out.txt')))
      .on('finish', function() {
        testFilesEqual('single_byte.txt', 'single_byte.out.txt', done);
      });
  });
});