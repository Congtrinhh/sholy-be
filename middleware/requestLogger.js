const logger = require("../config/logger");

function requestLogger(req, res, next) {
	// log when response finishes — not when request comes in
	res.on("finish", () => {
		const duration = Date.now() - req.startTime;
		const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

		logger[level]("Request completed", {
			method: req.method,
			path: req.originalUrl,
			status: res.statusCode,
			duration_ms: duration,
		});
	});

	next();
}

module.exports = requestLogger;
