const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema({
	short_url: {
		type: String,
		required: true,
		unique: true, // enforces 1-1 mapping at DB level
	},
	long_url: {
		type: String,
		required: true,
	},
	expire: {
		type: Date,
		required: true,
		default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
	},
});

// auto-delete expired documents (MongoDB TTL index)
urlSchema.index({ expire: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Url", urlSchema);
