#!/usr/bin/env node
// ─── Socket.IO Delivery Test ──────────────────────────────────────
// Tests whether socket events reach explore_feed, tag rooms, and specialists.
// Usage: node scripts/test-sockets.js
//
// Prerequisites: Server must be running on PORT (default 5000)

require('dotenv').config();
const { io: ioClient } = require('socket.io-client');
const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const API = `${BASE}/api`;

// ─── Helpers ──────────────────────────────────────────────────────

function httpRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API);
        const data = body ? JSON.stringify(body) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(url, { method, headers }, (res) => {
            let chunks = '';
            res.on('data', (d) => chunks += d);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(chunks) });
                } catch {
                    resolve({ status: res.statusCode, body: chunks });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

function createClient(name) {
    const socket = ioClient(BASE, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
    });
    return new Promise((resolve, reject) => {
        socket.on('connect', () => {
            console.log(`  ✅ [${name}] connected (id: ${socket.id})`);
            resolve(socket);
        });
        socket.on('connect_error', (err) => {
            reject(new Error(`[${name}] connect failed: ${err.message}`));
        });
        setTimeout(() => reject(new Error(`[${name}] connect timeout`)), 5000);
    });
}

function waitForEvent(socket, eventName, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
        });
    });
}

// ─── Test Runner ──────────────────────────────────────────────────

async function login() {
    // Try logging in with a known user; if not available, create one
    let res = await httpRequest('POST', `${API}/auth/login`, {
        email: 'socket-test@test.com',
        password: 'TestPassword123',
    });

    if (res.status === 200 && res.body.token) return res.body.token;

    // Try signup
    res = await httpRequest('POST', `${API}/auth/signup`, {
        name: 'Socket Test User',
        email: 'socket-test@test.com',
        password: 'TestPassword123',
        role: 'student',
    });

    if (res.status === 201 && res.body.token) return res.body.token;

    console.error('  ❌ Could not login or signup:', res.body);
    return null;
}

async function runTests() {
    console.log('\n🧪 Socket.IO Delivery Test');
    console.log('═'.repeat(50));
    console.log(`  Server: ${BASE}\n`);

    const results = { pass: 0, fail: 0 };

    function assert(name, condition) {
        if (condition) {
            console.log(`  ✅ PASS: ${name}`);
            results.pass++;
        } else {
            console.log(`  ❌ FAIL: ${name}`);
            results.fail++;
        }
    }

    // ── Step 1: Get auth token ──
    console.log('\n── Step 1: Authenticate ──');
    const token = await login();
    if (!token) {
        console.error('\n❌ Cannot proceed without auth token. Aborting.');
        process.exit(1);
    }
    console.log('  ✅ Got auth token');

    // ── Step 2: Connect 3 socket clients ──
    console.log('\n── Step 2: Connect Socket Clients ──');
    let exploreClient, tagClient, specialistClient;
    try {
        [exploreClient, tagClient, specialistClient] = await Promise.all([
            createClient('Explore'),
            createClient('TagFilter'),
            createClient('Specialist'),
        ]);
    } catch (err) {
        console.error(`\n❌ ${err.message}`);
        console.error('   Is the server running? Start it with: npm run dev');
        process.exit(1);
    }

    // ── Step 3: Join rooms ──
    console.log('\n── Step 3: Join Rooms ──');
    exploreClient.emit('join_explore');
    console.log('  [Explore] joined explore_feed');

    tagClient.emit('join_tags', ['mental-health']);
    console.log('  [TagFilter] joined tag:mental-health');

    specialistClient.emit('join_specialist_room', token);
    console.log('  [Specialist] joined specialists room');

    // Give server a moment to process joins
    await new Promise(r => setTimeout(r, 1000));

    // ── Step 4: Create a question and check delivery ──
    console.log('\n── Step 4: POST a question → check who receives it ──');

    const exploreWait = waitForEvent(exploreClient, 'new_question');
    const tagWait = waitForEvent(tagClient, 'new_question');
    const specialistWait = waitForEvent(specialistClient, 'new_question');

    const questionRes = await httpRequest('POST', `${API}/questions`, {
        title: 'Socket test question - does this arrive?',
        description: 'This is a test question to verify socket delivery to explore_feed and tag rooms. It should arrive in real-time.',
        tags: ['mental-health'],
    }, token);

    console.log(`  POST /api/questions → ${questionRes.status}`);
    if (questionRes.status !== 201) {
        console.error('  ❌ Question creation failed:', JSON.stringify(questionRes.body));
        console.log('\n  The socket emit happens AFTER insertOne — if creation fails, no emit fires.');
        console.log('  This is likely why your explore feed appears dead.\n');

        assert('Question creation succeeds (201)', false);
    } else {
        assert('Question creation succeeds (201)', true);
        console.log(`  Question ID: ${questionRes.body.question?.id || questionRes.body.question?._id}`);
    }

    // Wait for events
    const [exploreData, tagData, specialistData] = await Promise.all([
        exploreWait, tagWait, specialistWait,
    ]);

    console.log('\n── Step 5: Results ──');
    assert('Explore client received new_question', exploreData !== null);
    assert('Tag client (mental-health) received new_question', tagData !== null);
    assert('Specialist client did NOT receive new_question (specialists room is not targeted)', specialistData === null);

    if (exploreData) {
        assert('Payload includes tags[]', Array.isArray(exploreData.tags));
        assert('Payload includes _ts timestamp', typeof exploreData._ts === 'number');
        assert('Payload includes user object', exploreData.user != null);
        console.log(`  Payload tags: [${exploreData.tags?.join(', ')}]`);
        console.log(`  Payload _ts: ${exploreData._ts}`);
    }

    if (tagData) {
        assert('Tag payload matches explore payload', tagData._ts === exploreData?._ts);
    }

    // ── Cleanup ──
    console.log('\n── Cleanup ──');
    exploreClient.disconnect();
    tagClient.disconnect();
    specialistClient.disconnect();
    console.log('  All clients disconnected');

    // If the question was created, delete it
    if (questionRes.status === 201) {
        const qId = questionRes.body.question?.id || questionRes.body.question?._id;
        if (qId) {
            const delRes = await httpRequest('DELETE', `${API}/questions/${qId}`, null, token);
            console.log(`  Cleaned up test question: ${delRes.status}`);
        }
    }

    // ── Summary ──
    console.log('\n' + '═'.repeat(50));
    console.log(`  Results: ${results.pass} passed, ${results.fail} failed`);
    if (results.fail > 0) {
        console.log('\n  💡 If question creation failed (500), the MongoDB validation');
        console.log('     error is still active. Restart server to apply schema fix.');
        console.log('  💡 If clients connected but got no events, check room joins.');
    }
    console.log('');

    process.exit(results.fail > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
