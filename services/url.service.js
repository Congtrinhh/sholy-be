const md5 = require("md5");
const repo = require("../repositories/url.repository");

// convert hex string to base62
function toBase62(hexStr) {
	const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let num = BigInt("0x" + hexStr);
	let result = "";
	while (num > 0n) {
		result = chars[Number(num % 62n)] + result;
		num /= 62n;
	}
	return result;
}

function generateShortCode(longUrl) {
	const hash = md5(longUrl); // full md5 hex string
	const base62 = toBase62(hash); // convert to base62
	return base62.substring(0, 6); // take first 6 chars
}

async function createShortUrl({ long_url, short_url, expire }) {
	const expireDate = expire ? new Date(expire) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	// Case 1: user provided an alias
	if (short_url) {
		const existing = await repo.findByShortUrl(short_url);
		if (existing) {
			const err = new Error("This short URL is already in use. Please choose another.");
			err.status = 409; // Conflict
			throw err;
		}
		const saved = await repo.save({ short_url, long_url, expire: expireDate });
		await repo.setCachedUrl(short_url, long_url, expireDate);
		return saved;
	}

	// Case 2: system generates short code
	const shortCode = generateShortCode(long_url);
	const existing = await repo.findByShortUrl(shortCode);

	if (existing) {
		// same long URL already shortened — return existing without saving again
		return existing;
	}

	const saved = await repo.save({ short_url: shortCode, long_url, expire: expireDate });
	await repo.setCachedUrl(shortCode, long_url, expireDate);
	return saved;
}

async function getLongUrl(shortUrl) {
	// fast path: check cache first
	const cached = await repo.getCachedLongUrl(shortUrl);
	if (cached) return cached;

	// slow path: query DB on cache miss
	const record = await repo.findByShortUrl(shortUrl);
	if (!record) return null;

	// repopulate cache
	await repo.setCachedUrl(shortUrl, record.long_url, record.expire);
	return record.long_url;
}

module.exports = { createShortUrl, getLongUrl };
