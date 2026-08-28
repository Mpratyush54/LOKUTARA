// models/RefreshToken.js
const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true }, // jti
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },

  // Device info
  deviceId: { type: String, required: true },   // UUID assigned at login
  deviceName: { type: String },
  deviceType: { type: String }, // desktop / mobile / tablet
  os: { type: String },
  browser: { type: String },

  // Network / UA
  ip: { type: String },
  userAgent: { type: String },

  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false },
  replacedByTokenId: { type: String, default: null }
});

// optional TTL index to help cleanup (Mongo will remove when expiresAt passes)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);
