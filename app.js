require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const urlsRouter = require("./routes/urls");

const logger = require("./config/logger");

logger.info("logger: App.js loaded");
console.log("console log: App.js loaded[updated]");

const tracingMiddleware = require("./middleware/tracing");
const requestLogger = require("./middleware/requestLogger");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

const app = express();

// 1. tracing must be first — everything else depends on traceId existing
app.use(tracingMiddleware);
// 2. request logger — logs every request/response
app.use(requestLogger);

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Add health check endpoint BEFORE urlsRouter — to prevent the :short_url in urlRoute greedily receives requests
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));

app.use("", urlsRouter);

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
