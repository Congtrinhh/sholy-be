const express = require("express");
const { default: mongoose } = require("mongoose");
const router = express.Router();
const redis = require("../config/redis");

router.get("/healthz", async (req, res, next) => {
	try {
		const health = {
			status: "ok",
			redis: "ok",
			mongodb: "ok",
		};

		try {
			await redis.ping();
		} catch (error) {
			health.redis = "unreachable";
		}

		try {
			await mongoose.connection.db.admin().ping();
		} catch (error) {
			health.mongodb = "unreachable";
		}

		health.status = health.mongodb === "unreachable" || health.redis === "unreachable" ? "degraded" : "ok";
		const statusCode = health.status === "ok" ? 200 : 503;
		return res.status(statusCode).json(health);
	} catch (error) {
		next(error);
	}
});

module.exports = router;
