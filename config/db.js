const mongoose = require("mongoose");
const logger = require("../config/logger");

async function connectDB() {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		// temporarily log which host we connected to
		logger.info("MongoDB connected", {
			host: mongoose.connection.host,
		});
	} catch (err) {
		console.error("MongoDB connection error:", err);
		process.exit(1); // crash the app early if DB is unavailable
	}
}

module.exports = connectDB;
