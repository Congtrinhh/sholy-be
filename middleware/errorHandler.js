const logger = require("../config/logger");

// 404 handler — no route matched
function notFoundHandler(req, res, next) {
	const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
	err.status = 404;
	next(err); // forward to global error handler below
}

// global error handler — must have 4 params for Express to recognize it
function globalErrorHandler(err, req, res, next) {
	const status = err.status || 500;
	const isServerError = status >= 500;

	// 5xx = system error → log as error
	// 4xx = client error → log as warn
	if (isServerError) {
		logger.error("Unhandled exception", {
			error: err.message,
			stack: err.stack,
			method: req.method,
			path: req.originalUrl,
			status,
		});
	} else {
		logger.warn("Client error", {
			error: err.message,
			method: req.method,
			path: req.originalUrl,
			status,
		});
	}

	// never leak stack traces to client in production
	return res.status(status).json({
		error:
			isServerError && process.env.NODE_ENV === "production"
				? "An unexpected error occurred" // vague on purpose in prod
				: err.message, // detailed in dev
		traceId: req.traceId, // client can report this when filing a bug
	});
}

module.exports = { notFoundHandler, globalErrorHandler };
