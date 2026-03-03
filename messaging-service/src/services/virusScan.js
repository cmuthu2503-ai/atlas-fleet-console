/**
 * ClamAV virus scan stub
 * In production, connect to ClamAV daemon via TCP.
 * This stub always returns 'clean' for development.
 */
const config = require('../config');

async function scanBuffer(buffer) {
  // Stub: In production, send buffer to ClamAV daemon at config.clamav.host:config.clamav.port
  // Protocol: INSTREAM command, then stream chunks, then zero-length chunk
  console.log(`[VirusScan] Stub: scanning ${buffer.length} bytes (ClamAV at ${config.clamav.host}:${config.clamav.port})`);

  // Simulate async scan
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ clean: true, details: 'STUB: scan passed' });
    }, 50);
  });
}

module.exports = { scanBuffer };
