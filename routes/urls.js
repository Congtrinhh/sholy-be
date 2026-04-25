var express = require("express");
const logger = require("../config/logger");
var router = express.Router();
const urlService = require("../services/url.service");

// POST /urls
router.post("/urls", async function (req, res) {
	try {
		const { long_url, short_url, expireInNumber: expire_in_number } = req.body;

		if (!long_url) {
			logger.warn("Long url is required", {
				requestIp: req.ip,
			});
			return res.status(400).json({ error: "long_url is required" });
		}

		const expire = expire_in_number ? new Date(Date.now() + expire_in_number * 24 * 60 * 60 * 1000) : null;

		const result = await urlService.createShortUrl({ long_url, short_url, expire });

		logger.info("Short url created", {
			result,
		});

		return res.status(201).json(result);
	} catch (err) {
		return res.status(err.status || 500).json({ error: err.message });
	}
});

// GET /:short_url
router.get("/:short_url", async function (req, res) {
	try {
		const longUrl = await urlService.getLongUrl(req.params.short_url);
		if (!longUrl) {
			logger.warn("Couldn't find long url", {
				requestIp: req.ip,
			});
			return res.status(404).json({ error: "Invalid short URL" });
		}
		return res.redirect(302, longUrl);
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

module.exports = router;
