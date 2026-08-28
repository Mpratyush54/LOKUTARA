const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },

    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
    },

    passwordHash: { type: String, required: true },

    // profile fields
    name: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    rollNo: { type: Number, required: true },

    // security fields
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // roles
    roles: { type: [String], default: ['student'] },

    // Date of Birth
    dob: { type: Date, required: true },

    // OTP fields
    resetOtp: { type: String, default: null },
    resetOtpExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Correct export — prevents overwrite issues
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
