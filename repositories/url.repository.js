const Url = require("../models/url.model");
const redis = require("../config/redis");

async function findByShortUrl(shortUrl) {
	return Url.findOne({ short_url: shortUrl });
}

async function save(data) {
	const url = new Url(data);
	return url.save();
}

async function getCachedLongUrl(shortUrl) {
	return redis.get(`url:${shortUrl}`);
}

async function setCachedUrl(shortUrl, longUrl, expireDate) {
	const secondsUntilExpire = Math.floor((new Date(expireDate) - Date.now()) / 1000);
	if (secondsUntilExpire > 0) {
		await redis.set(`url:${shortUrl}`, longUrl, "EX", secondsUntilExpire);
	}
}

module.exports = { findByShortUrl, save, getCachedLongUrl, setCachedUrl };
