// APM - must be placed first, before require("dotenv").config();
const appInsights = require("applicationinsights");
appInsights
	.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
	.setAutoDependencyCorrelation(true)
	.setAutoCollectRequests(true)
	.setAutoCollectPerformance(true)
	.setAutoCollectExceptions(true)
	.start();

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const redis = require("./config/redis");
const urlsRouter = require("./routes/urls");
const indexRouter = require("./routes/index");

// application logs
const logger = require("./config/logger");

logger.info("App.js loaded");

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const tracingMiddleware = require("./middleware/tracing");
const requestLogger = require("./middleware/requestLogger");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

const app = express();

// prevent xss (put helmet and rate limit before api routes)
app.use(helmet());
// Rate limiting — prevent abuse and DDoS: allow no more than 100 requests from one host within 10 mins
const limiter = rateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 100, // max 100 requests per IP per window
	store: new RedisStore({
		sendCommand: (...args) => redis.call(...args),
	}),
	message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// 1. tracing must be first — everything else depends on traceId existing
app.use(tracingMiddleware);
// 2. request logger — logs every request/response
app.use(requestLogger);

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Add health check endpoint BEFORE urlsRouter — to prevent the :short_url in urlRoute greedily receives requests
// app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));
app.use(indexRouter);

app.use(urlsRouter);

// 5. error handlers must be LAST
app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
	app.listen(PORT, () => {
		logger.info("Server started", {
			port: PORT,
			environment: process.env.NODE_ENV,
			node_version: process.version,
		});
	});
});

module.exports = app;
