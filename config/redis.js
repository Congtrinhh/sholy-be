const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
	tls: process.env.REDIS_URL.startsWith("rediss://")
		? { rejectUnauthorized: false } // required for Azure Redis
		: undefined,
	lazyConnect: true,
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err));

module.exports = redis;
