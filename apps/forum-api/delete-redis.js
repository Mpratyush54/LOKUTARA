require('dotenv').config();
const { connectRedis, cacheDel, cacheGet } = require('./src/config/redis');

async function doDel() {
    const redis = connectRedis();
    await new Promise(r => setTimeout(r, 1000));
    console.log("deleting...");
    await cacheDel('config:launch_status');
    const cached = await cacheGet('config:launch_status');
    console.log("Cached Document after delete:", cached);
    process.exit(0);
}
doDel().catch(console.error);
