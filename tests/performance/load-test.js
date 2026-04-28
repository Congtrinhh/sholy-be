import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io";

export const options = {
	stages: [
		// { duration: "30s", target: 50 }, // ramp up to 50 users over 30s
		// { duration: "1m", target: 50 }, // hold 50 users for 1 minute
		// { duration: "30s", target: 100 }, // ramp up to 100 users
		// { duration: "1m", target: 100 }, // hold 100 users for 1 minute
		// { duration: "30s", target: 0 }, // ramp down

		{ duration: "30s", target: 100 }, // ramp up to 100 users over 30s
		{ duration: "1m", target: 100 }, // hold 100 users for 1 minute
		{ duration: "30s", target: 200 }, // ramp up to 200 users
		{ duration: "1m", target: 200 }, // hold 200 users for 1 minute
		{ duration: "30s", target: 0 }, // ramp down
	],
	thresholds: {
		http_req_duration: ["p(95)<100"], // 95% of requests must be under 100ms
		http_req_failed: ["rate<0.001"], // less than 0.1% failure rate
	},
};

// runs once per VU to generate unique short URLs
export function setup() {
	return { shortUrl: null };
}

export default function () {
	// Test POST /urls (shorten URL)
	const payload = JSON.stringify({
		long_url: `https://example.com/test-${__VU}-${__ITER}`,
	});

	const postRes = http.post(`${BASE_URL}/urls`, payload, {
		headers: { "Content-Type": "application/json" },
	});

	check(postRes, {
		"POST status is 201": (r) => r.status === 201,
		"POST response has short_url": (r) => JSON.parse(r.body).short_url !== undefined,
		"POST under 100ms": (r) => r.timings.duration < 100,
	});

	const shortUrl = JSON.parse(postRes.body).short_url;

	// Test GET /:short_url (redirect)
	const getRes = http.get(`${BASE_URL}/${shortUrl}`, {
		redirects: 0, // don't follow redirect, just measure the 302 response time
	});

	check(getRes, {
		"GET status is 302": (r) => r.status === 302,
		"GET under 100ms": (r) => r.timings.duration < 100,
	});

	sleep(1);
}
