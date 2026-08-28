const workerpool = require('workerpool');
const pool = workerpool.pool(__dirname + '/passwordWorker.js');

// ❌ Cache for failed attempts so bcrypt isn't run repeatedly
// Key: username + SHA256(password)
const crypto = require("crypto");
const failedCache = new Map();

function getKey(username, password) {
  return username + ":" + crypto.createHash("sha256").update(password).digest("hex");
}

async function hashPassword(password) {
  return await pool.exec("hashPassword", [password]);
}

async function verifyPassword(username, password, storedHash) {
  const key = getKey(username, password);

  // Cache only FAILED attempts (never successful ones)
  if (failedCache.has(key)) {
    return false; // skip expensive bcrypt
  }

  const ok = await pool.exec("verifyPassword", [password, storedHash]);

  if (!ok) {
    failedCache.set(key, true);
    setTimeout(() => failedCache.delete(key), 5 * 60 * 1000); // keep 5 minutes
  }

  return ok;
}

module.exports = { hashPassword, verifyPassword };
