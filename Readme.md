# Forward Error Correction
A transform stream module for node.js.

## Motivation
Node is all about I/O, so this might help someone who was trying to do I/O over a crappy channel. I don't have any specific use for it at the moment.

## Usage
```
npm install fec-stream
```
```js
var fec = require('fec-stream');

// For Hamming(8,4)
var encoder = new fec.Encoder({method: fec.methods.hamming84});
var decoder = new fec.Decoder({method: fec.methods.hamming84});

// For Reed-Solomon
var rsEncoder = new fec.Encoder({
  method: fec.methods.reedsolomon,
  ecclen: 32 // Number of error correction bytes (default: 32)
});
var rsDecoder = new fec.Decoder({
  method: fec.methods.reedsolomon,
  ecclen: 32 // Must match the encoder
});

readableStream.pipe(encoder).pipe(decoder).pipe(writableStream);
```

The available methods at this time are:
* Hamming(8,4)
* Reed-Solomon

## Developer's Guide

This guide explains how to add new Forward Error Correction (FEC) methods to the `fec-stream` library.

### Architecture Overview

The library is designed to be easily extensible with new FEC algorithms. The core logic resides in `lib/fec.js`, which manages the stream-based processing and dispatches the encoding and decoding tasks to the appropriate method.

Each FEC method is implemented as a separate module in the `lib/methods` directory. This modular approach keeps the concerns separated and makes it easy to add new methods without modifying the core library.

### Implementing a New Method

To add a new method, you need to create a new file in `lib/methods` that exports an object with the following functions:

*   `initEncoder(options)`: (Optional) A function to initialize the encoder. It is called in the `Encoder` constructor and receives the options object. You can use this to set up any necessary state on the stream instance (`this`).
*   `encode(data, encoding, done)`: The main encoding function. It is called as the `_transform` method of the `Encoder` stream.
*   `flushEncoder(done)`: (Optional) A function to handle any remaining data in the buffer when the stream is flushed. This is particularly important for block-based algorithms.
*   `initDecoder(options)`: (Optional) A function to initialize the decoder. It is called in the `Decoder` constructor.
*   `decode(data, encoding, done)`: The main decoding function. It is called as the `_transform` method of the `Decoder` stream.
*   `flushDecoder(done)`: (Optional) A function to handle any remaining data in the buffer when the stream is flushed.

### Example: Reed-Solomon

The Reed-Solomon implementation in `lib/methods/reedsolomon.js` serves as a good example of a block-based algorithm. It uses a buffer to accumulate data until it has a full block, then encodes or decodes it. The `flushEncoder` and `flushDecoder` functions are essential for handling the final, partially-filled block.

### Integrating the New Method

Once you have implemented your method, you need to integrate it into the main library:

1.  **Add to `methods` object:** In `lib/fec.js`, add your new method to the `methods` object. The key should be a short, programmatic name, and the value should be a human-readable name.
2.  **Require the module:** In `lib/fec.js`, require your new method module and add it to the `transforms` object, using the same key as in the `methods` object.

### Testing

The library uses `mocha` for testing. When adding a new method, you should also add a corresponding test file in the `test` directory. The tests should cover:

*   Encoding and decoding of small and large files.
*   Error correction capabilities.
*   Edge cases, such as files with sizes that are not multiples of the block size.

The test suite includes a fun and practical test using the text of the January 1900 issue of "Popular Science Monthly" to test the handling of larger files.

## Development
Run tests with mocha.

## Todo
Raptor coding.

from [http://science.nasa.gov/media/medialibrary/2011/04/13/NASA_Comm_Services_EV-2_TAGGED.pdf](http://science.nasa.gov/media/medialibrary/2011/04/13/NASA_Comm_Services_EV-2_TAGGED.pdf):

Most missions employ error detecting – error correcting codes to substantially improve
telemetry link performance. DSN users are reminded that their encoders should conform to the
CCSDS Telemetry Channel Coding Blue Book (CCSDS 231.0-B-1, September 2003.
Acceptable codes include: 1) Convolutional r = 1/2, k = 7 only; 2) Reed-Solomon 223/255 only;
3) concatenated Convolutional / Reed-Solomon and 4) Turbo codes with rates: 1/2, 1/3, 1/4, or
1/6, block sizes: 1784, 3568, 7136, and 8920.