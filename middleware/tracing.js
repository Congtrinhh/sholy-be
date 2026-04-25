const { v4: uuidv4 } = require("uuid");
const { asyncLocalStorage } = require("../config/context");

function tracingMiddleware(req, res, next) {
	// use existing trace ID from upstream (e.g. API gateway) or generate new one
	const traceId = req.headers["x-trace-id"] || uuidv4();

	// attach to response header so frontend/client can reference it
	res.setHeader("x-trace-id", traceId);

	// store in async context — available everywhere in this request's call stack
	asyncLocalStorage.run({ traceId }, () => {
		req.traceId = traceId;
		req.startTime = Date.now(); // used later for duration logging
		next();
	});
}

module.exports = tracingMiddleware;
