const mongoose = require('mongoose');

const LoginLogSchema = new mongoose.Schema({
  username: String,
  ip: String,
  status: Boolean,  // true = success
  message: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

// Prevent "OverwriteModelError" & Schema corruption
const LoginLog = mongoose.models.LoginLog || mongoose.model('LoginLog', LoginLogSchema);

module.exports = LoginLog;
