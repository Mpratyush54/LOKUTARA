const { Queue } = require("bullmq");
const { redisConfig } = require("../database/redis");

module.exports = new Queue("indexQueue", {
  connection: redisConfig,
});
