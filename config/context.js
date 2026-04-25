const { AsyncLocalStorage } = require("async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

function getTraceId() {
	const store = asyncLocalStorage.getStore();
	return store?.traceId || "no-trace";
}

module.exports = { asyncLocalStorage, getTraceId };
