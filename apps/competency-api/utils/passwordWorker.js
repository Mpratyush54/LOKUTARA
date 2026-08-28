// utils/passwordWorker.js
const workerpool = require('workerpool');
const argon2 = require('argon2');
const bcrypt = require('bcryptjs');

// Detect algorithm by hash prefix
function isArgon(hash) {
  return hash.startsWith("$argon2");
}

// Hash new password using argon2id
async function hashPassword(password) {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,   // 64MB RAM
    timeCost: 3,
    parallelism: 1
  });
}

// Verify password (argon2 or bcrypt depending on hash)
async function verifyPassword(password, storedHash) {
  if (isArgon(storedHash)) {
    return await argon2.verify(storedHash, password);
  }
  return await bcrypt.compare(password, storedHash); // legacy bcrypt
}

workerpool.worker({
  hashPassword,
  verifyPassword
});
