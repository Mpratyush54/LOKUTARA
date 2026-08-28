// declarations
const express = require('express');
const app = express.Router();
const jwt = require('jsonwebtoken');

// 🔥 Prometheus Function Timer
const startTimer = require('../utils/timer');

// 🔥 Redis Cache
const cache = require('../utils/cache');


// =====================================================
// =============== GLOBAL MIDDLEWARE ====================
// =====================================================
app.use('/', (req, res, next) => {
    const t_total = startTimer("users_root_middleware_total");

    const t_log = startTimer("users_root_middleware_log");
    // console.log(req.headers);
    t_log();

    // AUTH BLOCK (commented)
    
    const t_auth = startTimer("users_root_middleware_auth");
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
        t_auth();
        t_total();
        return res.status(401).json({ Status: false, Msg: "Unauthorized" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        t_auth();
        t_total();
        return next();
    } catch {
        t_auth();
        t_total();
        return res.status(401).json({ Status: false, Msg: "Invalid token" });
    }
    

    t_total();
    next();
});


// =====================================================
// =============== CHILD ROUTES WITH CACHING ============
// =====================================================

// CACHE TTL: 300 seconds (5 minutes)
// Adjust TTL based on route load patterns.

const t_entry_load = startTimer("users_root_mount_entry");
app.use('/entry', require('./user-survey')); 
t_entry_load();

const t_result_load = startTimer("users_root_mount_result");
app.use('/result',  require('./result')); 
t_result_load();

const t_fetch_tests_load = startTimer("users_root_mount_fetchTests");
app.use('/fetch-tests', require('./fetch-test')); 
t_fetch_tests_load();


// exporting the module
module.exports = app;
