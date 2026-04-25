const winston = require("winston");
const { getTraceId } = require("./context");

const logger = winston.createLogger({
	level: process.env.NODE_ENV === "production" ? "info" : "debug",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.printf((info) => {
			// inject traceId into every log line automatically
			const log = {
				timestamp: info.timestamp,
				level: info.level,
				traceId: getTraceId(), // ← always included, no manual work needed
				message: info.message,
				...info, // spread rest of metadata
			};
			// remove duplicated fields added by printf
			delete log.timestamp;
			delete log.message;
			delete log.level;
			return JSON.stringify(log);
		}),
	),
	transports: [new winston.transports.Console()],
});

module.exports = logger;
