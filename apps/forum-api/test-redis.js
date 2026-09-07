require('dotenv').config();
const { connectRedis, cacheGet } = require('./src/config/redis');

async function checkRedis() {
    const redis = connectRedis();
    await new Promise(r => setTimeout(r, 1000));
    const cached = await cacheGet('config:launch_status');
    console.log("Cached Document:", cached);
    process.exit(0);
}
checkRedis().catch(console.error);
