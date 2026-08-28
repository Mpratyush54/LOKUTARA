// -------------------- IMPORTS --------------------
const express = require('express');
const app = express();
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const DB = require('./database/mongo.cjs');

// ---------------- PROMETHEUS METRICS --------------------
const promClient = require('prom-client');

// Collect default system metrics
promClient.collectDefaultMetrics({ prefix: 'psych_' });

// Total HTTP requests counter
const httpRequestsTotal = new promClient.Counter({
    name: 'psych_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
});

// Duration per route
const httpRequestDuration = new promClient.Histogram({
    name: 'psych_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 1, 2, 5]
});

// Function timing histogram (for internal functions)
const functionDuration = new promClient.Histogram({
    name: 'psych_function_duration_seconds',
    help: 'Time taken by internal functions',
    labelNames: ['function'],
    buckets: [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.3, 1, 2]
});

module.exports.functionDuration = functionDuration;



// -------------------- OPEN TELEMETRY TRACING --------------------
let tracer = null;

try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

    const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_URL || "http://localhost:4318/v1/traces"
        }),
        instrumentations: [getNodeAutoInstrumentations()]
    });

    sdk.start();
    tracer = require('@opentelemetry/api').trace.getTracer('app-main');

    console.log("✅ OpenTelemetry tracing enabled");
} catch (err) {
    console.log("⚠️ OTEL disabled:", err.message);
}



// -------------------- ENV --------------------
dotenv.config({ path: './.env' });
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN, // https://competency-mapping.vercel.app
  "http://localhost:3000"
];



// -------------------- CORS --------------------
app.use(function (req, res, next) {
const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-username, x-email, x-token"
    );
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

app.use(bodyParser.json());



// -------------------- ROUTES --------------------
app.use("/auth", require('./auth/login'));
app.use("/auth/sign-up", require('./auth/registeration'));

app.use("/api/admin", require('./admin/routing'));
app.use("/api/users", require('./users/routing'));



// -------------------- ROUTE LABEL HELPER --------------------
function getRouteLabel(req) {
    if (req.route && req.route.path) {
        if (req.baseUrl) return req.baseUrl + req.route.path;
        return req.route.path;
    }
    if (req.baseUrl) return req.baseUrl;
    return "/unknown"; // bots / random requests
}



// -------------------- METRICS MIDDLEWARE (AFTER ROUTES) --------------------
app.use((req, res, next) => {
    const start = Date.now();

    const span = tracer ? tracer.startSpan(`HTTP ${req.method} ${req.originalUrl}`) : null;

    res.on("finish", () => {
        const duration = (Date.now() - start) / 1000;
        const routeLabel = getRouteLabel(req);

        // Count total requests
        httpRequestsTotal.inc({
            method: req.method,
            route: routeLabel,
            status: res.statusCode
        });

        // Record duration
        httpRequestDuration.labels(req.method, routeLabel).observe(duration);

        if (span) {
            span.setAttribute("http.status", res.statusCode);
            span.end();
        }
    });

    next();
});



// -------------------- METRICS ENDPOINT --------------------
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
    } catch (err) {
        res.status(500).send(err.message);
    }
});



// -------------------- SERVER --------------------
const serve = app.listen(process.env.PORT || 3010, () => {
    console.log("🚀 Server running on " + (process.env.PORT || 3010));
});

module.exports = app;
