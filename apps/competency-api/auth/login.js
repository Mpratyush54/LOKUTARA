// routes/auth.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require("express-rate-limit");
const Joi = require('joi');
const bcrypt = require("bcryptjs"); // legacy users only
const { uuid: uuidv4 } = require("uuidv4");
const UAParser = require("ua-parser-js");

const User = require('../models/Login');
const LoginLog = require('../models/LoginLog');
const RefreshToken = require('../models/RefreshToken');

// NEW — worker-based hashing
const { hashPassword, verifyPassword } = require("../utils/password");

// Prometheus Timer
const startTimer = require('../utils/timer');

const router = express.Router();


// ---------------- SECURITY ----------------
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");

router.use(helmet());
router.use(express.json({ limit: "10kb" }));
router.use(cookieParser());
router.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }));


// ------------ HELPERS ----------------
function getIp(req) {
    const t = startTimer("helper_getIp");
    const fwd = req.headers["x-forwarded-for"];
    t();
    return fwd ? fwd.split(",")[0].trim() : req.socket.remoteAddress;
}

function signAccessToken(user) {
    const t = startTimer("helper_signAccessToken");
    const out = jwt.sign(
        { id: user._id, username: user.username, roles: user.roles },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
    );
    t();
    return out;
}

function signRefreshToken(tokenId, user) {
    const t = startTimer("helper_signRefreshToken");
    const out = jwt.sign(
        { id: user._id, username: user.username, jti: tokenId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES || "30d" }
    );
    t();
    return out;
}

function parseDuration(str) {
    if (!str) return 0;
    if (typeof str === "number") return str;
    const v = parseInt(str);
    if (str.endsWith("ms")) return v;
    if (str.endsWith("s")) return v * 1000;
    if (str.endsWith("m")) return v * 60000;
    if (str.endsWith("h")) return v * 3600000;
    if (str.endsWith("d")) return v * 86400000;
    return v;
}

function parseDeviceFromReq(req) {
    const t = startTimer("helper_parseDevice");
    const parser = new UAParser(req.get("User-Agent") || "");
    const r = parser.getResult();
    t();
    return {
        deviceName: r.device.vendor || "Unknown",
        deviceType: r.device.type || "desktop",
        os: r.os.name || "Unknown",
        browser: r.browser.name || "Unknown",
        userAgent: req.get("User-Agent") || ""
    };
}

function isSuspicious(dbToken, ip, ua) {
    const t = startTimer("helper_isSuspicious");

    const mode = (process.env.SUSPICIOUS_MODE || "strict").toLowerCase();
    const sameIp = dbToken.ip === ip;
    const sameUA = dbToken.userAgent === ua;

    let out;
    if (mode === "off") out = false;
    else if (mode === "loose") out = !sameIp && !sameUA;
    else out = !sameIp || !sameUA;

    t();
    return out;
}


// ---------------- VALIDATION ----------------
const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const forgotSchema = Joi.object({
    username: Joi.string().required(),
    dob: Joi.date().required()
});

const resetSchema = Joi.object({
    username: Joi.string().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(6).required()
});


// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
    const t_total = startTimer("login_total");

    try {
        const t_validate = startTimer("login_validate");
        const { error, value } = loginSchema.validate(req.body);
        t_validate();

        if (error) {
            t_total();
            return res.status(400).json({ Status: false, Msg: "Invalid input" });
        }

        const { username, password } = value;
        const ip = getIp(req);
        const ua = req.get("User-Agent") || "";

        const t_find = startTimer("login_findUser");
        const user = await User.findOne({ username });
        t_find();

        if (!user) {
            t_total();
            return res.status(401).json({ Status: false, Msg: "Invalid credentials" });
        }

        // PASSWORD CHECK (worker thread)
        const t_pw = startTimer("login_comparePassword");
        const ok = await verifyPassword(username, password, user.passwordHash);
        t_pw();

        if (!ok) {
            t_total();
            return res.status(401).json({ Status: false, Msg: "Invalid credentials" });
        }

        const device = parseDeviceFromReq(req);

        // Generate tokens
        const tokenId = uuidv4();
        const deviceId = uuidv4();
        const accessToken = signAccessToken(user);
        const refreshJwt = signRefreshToken(tokenId, user);

        // Save refresh token in DB
        await RefreshToken.create({
            tokenId,
            userId: user._id,
            username: user.username,
            deviceId,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            os: device.os,
            browser: device.browser,
            ip,
            userAgent: device.userAgent,
            expiresAt: new Date(Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRES || "30d"))
        });

        // Set cookie
        res.cookie("refreshToken", refreshJwt, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: parseDuration(process.env.JWT_REFRESH_EXPIRES || "30d")
        });

        t_total();

        return res.json({
            Status: true,
            Msg: "Login successful",
            Token: accessToken,
            refreshTokenId: tokenId,
            deviceId,
            User: {
                username: user.username,
                name: user.name,
                class: user.class,
                section: user.section,
                rollNo: user.rollNo,
                roles: user.roles
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        t_total();
        return res.status(500).json({ Status: false, Msg: "Server error" });
    }
});


// ---------------- REFRESH TOKEN ----------------
router.post("/refresh", async (req, res) => {
    const t_total = startTimer("refresh_total");

    try {
        const token = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!token)
            return res.status(401).json({ Status: false, Msg: "No refresh token" });

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ Status: false, Msg: "Invalid token" });
        }

        const dbToken = await RefreshToken.findOne({ tokenId: payload.jti });
        if (!dbToken || dbToken.revoked)
            return res.status(401).json({ Status: false, Msg: "Refresh token invalid" });

        const ip = getIp(req);
        const ua = req.get("User-Agent") || "";

        if (isSuspicious(dbToken, ip, ua)) {
            await RefreshToken.updateMany({ userId: dbToken.userId }, { revoked: true });
            res.clearCookie("refreshToken");
            return res.status(401).json({
                Status: false,
                Msg: "Suspicious activity detected. Login again."
            });
        }

        const user = await User.findById(payload.id).lean();
        if (!user) return res.status(401).json({ Status: false, Msg: "User not found" });

        const newTokenId = uuidv4();
        const newRefresh = signRefreshToken(newTokenId, user);
        const newAccess = signAccessToken(user);

        dbToken.revoked = true;
        dbToken.replacedByTokenId = newTokenId;
        await dbToken.save();

        await RefreshToken.create({
            tokenId: newTokenId,
            userId: dbToken.userId,
            username: user.username,
            deviceId: dbToken.deviceId,
            deviceName: dbToken.deviceName,
            deviceType: dbToken.deviceType,
            os: dbToken.os,
            browser: dbToken.browser,
            ip,
            userAgent: ua,
            expiresAt: new Date(Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRES || "30d"))
        });

        res.cookie("refreshToken", newRefresh, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: parseDuration(process.env.JWT_REFRESH_EXPIRES || "30d")
        });

        t_total();
        return res.json({
            Status: true,
            Msg: "Token refreshed",
            Token: newAccess,
            refreshTokenId: newTokenId
        });

    } catch (err) {
        console.error("Refresh error:", err);
        t_total();
        return res.status(500).json({ Status: false, Msg: "Server error" });
    }
});


// ---------------- FORGOT PASSWORD ----------------
router.post("/forgot", async (req, res) => {
    const t_total = startTimer("forgot_total");

    try {
        const { error, value } = forgotSchema.validate(req.body);
        if (error) return res.status(400).json({ Status: false, Msg: "Invalid input" });

        const user = await User.findOne({ username: value.username });
        if (!user)
            return res.status(404).json({ Status: false, Msg: "User not found" });

        const inputDob = new Date(value.dob).toISOString().slice(0, 10);
        const storedDob = new Date(user.dob).toISOString().slice(0, 10);
        if (inputDob !== storedDob)
            return res.status(403).json({ Status: false, Msg: "DOB mismatch" });

        const otp = ("000000" + Math.floor(Math.random() * 1000000)).slice(-6);

        user.resetOtp = otp;
        user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60000);
        await user.save();

        t_total();
        return res.json({ Status: true, Msg: "OTP generated", OTP: otp, expiresIn: 600 });

    } catch (err) {
        console.error("Forgot error:", err);
        t_total();
        return res.status(500).json({ Status: false, Msg: "Server error" });
    }
});


// ---------------- RESET PASSWORD ----------------
router.post("/reset", async (req, res) => {
    const t_total = startTimer("reset_total");

    try {
        const { error, value } = resetSchema.validate(req.body);
        if (error) return res.status(400).json({ Status: false, Msg: "Invalid input" });

        const user = await User.findOne({ username: value.username });
        if (!user)
            return res.status(404).json({ Status: false, Msg: "User not found" });

        if (!user.resetOtp || Date.now() > new Date(user.resetOtpExpiresAt))
            return res.status(400).json({ Status: false, Msg: "OTP expired" });

        if (value.otp !== user.resetOtp)
            return res.status(403).json({ Status: false, Msg: "Invalid OTP" });

        // NEW PASSWORD HASH (argon2)
        const hash = await hashPassword(value.newPassword);

        user.passwordHash = hash;
        user.resetOtp = null;
        user.resetOtpExpiresAt = null;
        await user.save();

        t_total();
        return res.json({ Status: true, Msg: "Password reset successful" });

    } catch (err) {
        console.error("Reset error:", err);
        t_total();
        return res.status(500).json({ Status: false, Msg: "Server error" });
    }
});


module.exports = router;
