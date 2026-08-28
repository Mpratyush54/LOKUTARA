// utils/timer.js

const { functionDuration } = require('../app');

/**
 * Start a Prometheus timer for internal function execution.
 * 
 * @param {string} name - Name of the function or step being measured.
 * @returns {function} - Call this returned function to stop the timer.
 */
function startFunctionTimer(name) {
    try {
        const end = functionDuration.startTimer({ function: name });
        return end;    // Call end() to stop timer
    } catch (err) {
        console.error("Timer error:", err.message);
        return () => {}; // fail-safe no-op
    }
}

module.exports = startFunctionTimer;
