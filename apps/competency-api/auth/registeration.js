// routes/signup.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');

const User = require('../models/Login');

// 🔥 Prometheus Function Timer
const startTimer = require('../utils/timer');

// 🔥 Worker-thread password hashing (argon2id)
const { hashPassword } = require("../utils/password");

const app = express();

// Security
app.use(helmet());
app.use(express.json({ limit: '10kb' }));


// ---------------------------------------------------
// Helper: Generate username suggestions
// ---------------------------------------------------
function generateSuggestions(username) {
    const t = startTimer("signup_generateSuggestions");
    const rand = () => Math.floor(Math.random() * 10000);
    const out = [
        username + rand(),
        username + "_" + rand(),
        rand() + "_" + username
    ];
    t();
    return out;
}


// ---------------------------------------------------
// SIGNUP
// ---------------------------------------------------
app.post('/', async (req, res) => {
    const t_total = startTimer("signup_total");

    try {
        const t_extract = startTimer("signup_extractFields");
        const {
            username,
            email,
            password,
            name,
            class: className,
            section,
            rollNo,
            dob
        } = req.body;
        t_extract();


        // ---------------------------------------------------
        // 1️⃣ Validate Required Fields
        // ---------------------------------------------------
        const t_validate = startTimer("signup_validateFields");

        if (!username || !email || !password || !name || !className || !section || !rollNo || !dob) {
            t_validate();
            t_total();
            return res.status(400).json({
                Status: false,
                Error: true,
                Msg: "Missing fields: username, email, password, name, class, section, rollNo, dob"
            });
        }

        if (password.length < 6) {
            t_validate();
            t_total();
            return res.status(400).json({
                Status: false,
                Error: true,
                Msg: "Password must be at least 6 characters"
            });
        }

        t_validate();


        // ---------------------------------------------------
        // 2️⃣ Check Username Exists
        // ---------------------------------------------------
        const t_findUser = startTimer("signup_findUserByUsername");
        const existingUser = await User.findOne({ username });
        t_findUser();

        if (existingUser) {
            t_total();
            return res.status(409).json({
                Status: false,
                Error: true,
                Msg: "Username already exists",
                Suggestions: generateSuggestions(username)
            });
        }


        // ---------------------------------------------------
        // 3️⃣ Check Email Exists
        // ---------------------------------------------------
        const t_findEmail = startTimer("signup_findUserByEmail");
        const existingEmail = await User.findOne({ email });
        t_findEmail();

        if (existingEmail) {
            t_total();
            return res.status(409).json({
                Status: false,
                Error: true,
                Msg: "Email already registered. Try login or reset password."
            });
        }


        // ---------------------------------------------------
        // 4️⃣ Hash Password (argon2id via worker thread)
        // ---------------------------------------------------
        const t_hash = startTimer("signup_hashPassword");

        const passwordHash = await hashPassword(password);  
        // ⚡ NO blocking main thread  
        // ⚡ Works on ARM + x86  
        // ⚡ Faster than bcrypt  

        t_hash();


        // ---------------------------------------------------
        // 5️⃣ Create User
        // ---------------------------------------------------
        const t_create = startTimer("signup_createUser");
        const newUser = new User({
            username,
            email,
            passwordHash,   // stored argon2 hash
            name,
            class: className,
            section,
            rollNo,
            dob,
            roles: ["student"]
        });
        t_create();


        // ---------------------------------------------------
        // 6️⃣ Save to DB
        // ---------------------------------------------------
        const t_save = startTimer("signup_saveUser");
        await newUser.save();
        t_save();


        t_total();
        return res.status(201).json({
            Status: true,
            Error: false,
            Msg: "User registered successfully"
        });

    } catch (err) {
        console.error("Signup error:", err);
        t_total();

        return res.status(500).json({
            Status: false,
            Error: true,
            Msg: "Server error"
        });
    }
});


module.exports = app;
