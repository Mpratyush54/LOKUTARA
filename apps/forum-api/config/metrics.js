const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
    register,
    prefix: 'forum_',
});

// HTTP request counter
const httpRequestsTotal = new client.Counter({
    name: 'forum_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
});

// request duration
const httpRequestDuration = new client.Histogram({
    name: 'forum_http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5],
});

// active socket connections
const activeSockets = new client.Gauge({
    name: 'forum_active_socket_connections',
    help: 'Active socket connections',
});
const socketRooms = new client.Gauge({
    name: "forum_socket_rooms_total",
    help: "Total active socket rooms"
});

const socketBroadcasts = new client.Counter({
    name: "forum_socket_broadcast_total",
    help: "Total socket broadcast events"
});

const redisAdapterStatus = new client.Gauge({
    name: "forum_socket_redis_adapter_connected",
    help: "Redis adapter connection status (1=connected)"
});
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(activeSockets);
register.registerMetric(socketRooms);
register.registerMetric(socketBroadcasts);
register.registerMetric(redisAdapterStatus);
module.exports = {
    register,
    httpRequestsTotal,
    httpRequestDuration,
    activeSockets,
};