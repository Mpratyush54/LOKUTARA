// ─── Forum Backend Server ─────────────────────────────────────────
require('dotenv').config();

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB, closeDB } = require('./config/database');
const { initCollections } = require('./config/init');
const { connectRedis, closeRedis, getRedis } = require('./config/redis');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verifyToken } = require('./middleware/auth');

// 🔵 IMPORT YOUR EXISTING METRICS
const {
    register,
    httpRequestsTotal,
    httpRequestDuration,
    activeSockets,
    socketRooms,
    socketBroadcasts,
    redisAdapterStatus
} = require('./../config/metrics');

// 🔵 POD IDENTIFICATION FOR SCALING MONITORING
const POD_NAME = process.env.POD_NAME || 'local';


// Route imports
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const answerRoutes = require('./routes/answers');
const userRoutes = require('./routes/users');
const moderationRoutes = require('./routes/moderation');
const tagRoutes = require('./routes/tags');
const adminRoutes = require('./routes/admin');
const configRoutes = require('./routes/config');
const webhookRoutes = require('./routes/webhook');
const { launchCheck } = require('./middleware/launchCheck');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;


// ──────────────── REQUEST METRICS TRACKING ────────────────
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;

        if (httpRequestsTotal) {
            httpRequestsTotal.inc({
                method: req.method,
                route: req.route?.path || req.path,
                status: res.statusCode
            });
        }

        if (httpRequestDuration) {
            httpRequestDuration.observe({
                method: req.method,
                route: req.route?.path || req.path,
                status: res.statusCode
            }, duration);
        }
    });

    next();
});


// ──────────────── METRICS ENDPOINT ────────────────
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});


// ──────────────── Swagger Documentation ────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// ──────────────── Socket.IO Setup ────────────────
const io = new Server(server, {
    cors: {
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            'https://forum-gamma-one.vercel.app',
            'http://localhost:3000',
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    connectTimeout: 10000,
    maxHttpBufferSize: 1e6,
    perMessageDeflate: { threshold: 1024 },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
    },
});


// ──────────────── Redis Adapter (SCALING METRICS ENABLED) ────────────────
const pubClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true
});

const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        if (redisAdapterStatus) redisAdapterStatus.set(1);
        console.log('✅ Socket.IO Redis Adapter configured');
    })
    .catch(err => {
        if (redisAdapterStatus) redisAdapterStatus.set(0);
        console.warn('⚠️ Redis Adapter failed:', err.message);
    });


// ──────────────── SOCKET CONNECTION MONITORING ────────────────
io.on('connection', (socket) => {

    // Active socket count per pod
    if (activeSockets) {
        activeSockets.inc({ pod: POD_NAME });
    }

    // Track room changes dynamically
    if (socketRooms) {
        socketRooms.set(io.sockets.adapter.rooms.size);
    }

    socket.onAny(() => {
        if (socketRooms) {
            socketRooms.set(io.sockets.adapter.rooms.size);
        }
    });

    socket.on('disconnect', () => {
        if (activeSockets) {
            activeSockets.dec({ pod: POD_NAME });
        }

        if (socketRooms) {
            socketRooms.set(io.sockets.adapter.rooms.size);
        }
    });

});


// Make io accessible
app.use((req, res, next) => {
    req.io = io;
    next();
});


// ──────────────── Security Middleware ────────────────
app.use(helmet());


// ──────────────── CORS ────────────────
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'https://forum-gamma-one.vercel.app',
        'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-bypass-token', 'x-api-key'],
}));


// ──────────────── Body Parsing ────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// ──────────────── Logging ────────────────
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}


// ──────────────── Health Check ────────────────
app.get('/api/health', async (req, res) => {
    const redis = getRedis();
    const redisStatus = redis ? 'connected' : 'disconnected';

    res.json({
        status: 'ok',
        pod: POD_NAME,
        services: {
            mongodb: 'connected',
            redis: redisStatus,
            socketio: 'initialized',
        },
    });
});


// ──────────────── API Routes ────────────────
app.use('/api/auth', authRoutes); // Auth decides its own logic (e.g., signups are already guarded)
app.use('/api/questions', launchCheck, questionRoutes);
app.use('/api/answers', launchCheck, answerRoutes);
app.use('/api/users', launchCheck, userRoutes);
app.use('/api/moderation', launchCheck, moderationRoutes);
app.use('/api/tags', launchCheck, tagRoutes);
app.use('/api/admin', launchCheck, adminRoutes);
app.use('/api/config', configRoutes); // Config manages the launch status itself
app.use('/', webhookRoutes); // Top-level endpoint for external webhooks like Google Sheets


// ──────────────── 404 Handler ────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
});


// ──────────────── Error Handler ────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error.'
            : err.message,
    });
});


// ──────────────── Start Server ────────────────
async function startServer() {
    try {
        await connectDB();
        initCollections();
        connectRedis();

        server.listen(PORT, () => {
            console.log(`🚀 Forum API running on port ${PORT}`);
        });

    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    await closeDB();
    await closeRedis();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeDB();
    await closeRedis();
    process.exit(0);
});

startServer();

module.exports = app;