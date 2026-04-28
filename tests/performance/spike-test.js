import http from "k6/http";
import { check } from "k6";

const BASE_URL = "https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io";

export const options = {
	stages: [
		// { duration: "10s", target: 5 }, // normal traffic
		// { duration: "10s", target: 500 }, // sudden spike to 500 users
		// { duration: "1m", target: 500 }, // hold spike
		// { duration: "10s", target: 5 }, // back to normal
		// { duration: "30s", target: 5 }, // observe recovery

		{ duration: "10s", target: 10 }, // normal traffic
		{ duration: "10s", target: 1000 }, // sudden spike to 1000 users
		{ duration: "1m", target: 1000 }, // hold spike
		{ duration: "10s", target: 10 }, // back to normal
		{ duration: "30s", target: 10 }, // observe recovery
	],
	thresholds: {
		http_req_failed: ["rate<0.001"], // system must stay available (< 0.1% errors)
	},
};

export default function () {
	const res = http.get(`${BASE_URL}/healthz`);
	check(res, {
		"is available": (r) => r.status === 200,
	});
}
