# Sholy Incident Runbook

**App:** Sholy URL Shortener  
**Backend:** Azure Container Apps → `sholy-backend`  
**Database:** Azure Cosmos DB → `sholy-cosmos`  
**Cache:** Azure Cache for Redis → `sholy-redis`  
**Monitoring:** Application Insights → `sholy-insights`  
**Resource Group:** `sholy-rg`

---

## General First Steps (Run These First for Any Incident)

1. Check Application Insights → Live Metrics for real-time request/failure rate
2. Check active revision and health state:

```bash
az containerapp revision list \
  --name sholy-backend \
  --resource-group sholy-rg \
  --output table
```

3. Check container logs:

```bash
az containerapp logs show \
  --name sholy-backend \
  --resource-group sholy-rg \
  --tail 50
```

4. Note the `traceId` from any error response — search it in Log Analytics:

```kusto
ContainerAppConsoleLogs_CL
| where log_s contains "<traceId>"
| order by TimeGenerated desc
```

---

## Incident 1 — Container Crash Loop

### Detection

- Alert: Container App health state = `Unhealthy`
- Symptom: App returns `503 Service Unavailable`
- System logs show: `Container 'sholy-backend' was terminated with exit code '1'`

### Diagnosis

```bash
# Check system events for crash reason
az containerapp logs show \
  --name sholy-backend \
  --resource-group sholy-rg \
  --type system \
  --tail 30

# Check which revision is active and its health
az containerapp revision list \
  --name sholy-backend \
  --resource-group sholy-rg \
  --output table
```

Look for these common exit code 1 causes in logs:

- `Cannot find module` → wrong entry point in Dockerfile
- `ENOTFOUND` → wrong connection string (MongoDB or Redis)
- `ECONNREFUSED` → Redis or MongoDB unreachable

### Resolution

**Option A — Roll back to last healthy revision (fastest, < 2 min)**

```bash
# Find last healthy revision name from the table above
az containerapp ingress traffic set \
  --name sholy-backend \
  --resource-group sholy-rg \
  --revision-weight <last-healthy-revision-name>=100

# Deactivate the crashing revision
az containerapp revision deactivate \
  --name sholy-backend \
  --resource-group sholy-rg \
  --revision <crashing-revision-name>
```

**Option B — Fix and redeploy via GitHub Actions**

1. Fix the root cause in code
2. Push to `main` branch
3. Wait for CI/CD pipeline to complete (~3-5 min)
4. Verify new revision is healthy:

```bash
az containerapp revision list \
  --name sholy-backend \
  --resource-group sholy-rg \
  --output table
```

### Verification

```bash
curl https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/healthz
# Expected: {"status":"ok","redis":"ok","mongodb":"ok"}
```

---

## Incident 2 — App Returns 5xx

### Detection

- Alert: `high-failure-rate` alert triggered in Application Insights
- Symptom: Users report errors, frontend shows failed requests
- Application Insights → Failures shows spike in 5xx responses

### Diagnosis

**Step 1 — Find the failing requests**

Application Insights → Transaction Search → filter by `5xx` → click any failed request → examine the full trace and dependency calls

**Step 2 — Check logs with traceId from the failed request**

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "sholy-backend"
| where log_s contains "error"
| order by TimeGenerated desc
| take 50
```

**Step 3 — Check if it's a dependency issue**

```bash
# Check MongoDB connectivity
az cosmosdb show \
  --name sholy-cosmos \
  --resource-group sholy-rg \
  --query "properties.provisioningState"

# Check Redis connectivity
az redis show \
  --name sholy-redis \
  --resource-group sholy-rg \
  --query provisioningState
```

**Step 4 — Check Cosmos DB RU throttling**

Portal → Cosmos DB → sholy-cosmos → Metrics → Throttled Requests  
If 429s are present → you've hit the 1000 RU/s free tier limit

### Resolution

**If caused by code bug:**

1. Identify the error from Application Insights stack trace
2. Fix in code → push to `main` → wait for CI/CD

**If caused by Cosmos DB throttling (429):**

1. Temporary fix — scale up RU/s in portal:
   Portal → Cosmos DB → sholy-cosmos → Scale → increase RU/s temporarily
2. Long-term fix — optimize queries or upgrade tier

**If caused by unhandled exception:**

1. Check globalErrorHandler logs for stack trace
2. Fix the unhandled case in code → redeploy

### Verification

```bash
# Make a test POST request
curl -X POST https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/urls \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://example.com"}'
# Expected: 201 with short_url in response

# Make a test GET request with the returned short_url
curl -I https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/<short_url>
# Expected: 302 with Location header pointing to long URL
```

---

## Incident 3 — Redis Down

### Detection

- Alert: Redis alert triggered in Azure Monitor
- Symptom: App still works but is slower than usual (cache misses, all requests hitting MongoDB)
- Logs show: `Redis error: connection refused` or `Redis error: ENOTFOUND`

### Important Note

> Redis down does NOT take the app down. Your app falls back to MongoDB automatically on cache miss. This is a performance degradation incident, not a full outage.

### Diagnosis

```bash
# Check Redis provisioning state
az redis show \
  --name sholy-redis \
  --resource-group sholy-rg \
  --query "[provisioningState, redisVersion, sku]"

# Check Redis metrics in portal
# Portal → Redis → sholy-redis → Metrics → Connected Clients
# If connected clients = 0 → Redis is unreachable
```

Check container logs for Redis errors:

```kusto
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "sholy-backend"
| where log_s contains "Redis"
| order by TimeGenerated desc
| take 20
```

### Resolution

**Step 1 — Verify Redis is actually down (not just a blip)**

Wait 2 minutes and check `/healthz`:

```bash
curl https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/healthz
# If redis: "unreachable" → confirmed down
# If redis: "ok" → transient issue, already recovered
```

**Step 2 — Restart Redis if confirmed down**

Portal → Redis → sholy-redis → Restart  
Wait ~5 minutes for Redis to come back online.

**Step 3 — Verify app reconnects automatically**

`ioredis` has built-in reconnection — once Redis is back, the app reconnects without restart. Verify:

```bash
curl https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/healthz
# Expected: {"status":"ok","redis":"ok","mongodb":"ok"}
```

**Step 4 — Monitor MongoDB RU consumption during Redis outage**

Portal → Cosmos DB → sholy-cosmos → Metrics → Total Request Units  
During Redis downtime all reads hit MongoDB directly — watch for RU throttling (429s).  
If approaching 1000 RU/s limit → temporarily reduce traffic or scale up RU/s.

### Verification

```bash
curl https://sholy-backend.ambitiousbeach-3aa72412.southeastasia.azurecontainerapps.io/healthz
# Expected: {"status":"ok","redis":"ok","mongodb":"ok"}
```

Check cache hit rate recovered:  
Portal → Redis → sholy-redis → Metrics → Cache Hits vs Cache Misses  
Hit rate should return to > 80% within 15 minutes as cache warms up.

---

## Escalation Path

| Severity                   | Response Time | Action                                        |
| -------------------------- | ------------- | --------------------------------------------- |
| App fully down (503)       | Immediate     | Roll back revision first, investigate second  |
| 5xx rate > 1%              | < 15 min      | Investigate via Application Insights          |
| Redis down                 | < 30 min      | Monitor MongoDB RU, restart Redis             |
| High latency (p95 > 100ms) | < 1 hour      | Check Redis hit rate and Cosmos DB throttling |

---

## Useful Portal Links

| Resource          | Portal Link                                                   |
| ----------------- | ------------------------------------------------------------- |
| Container App     | Portal → Container Apps → sholy-backend                       |
| Live Metrics      | Portal → Application Insights → sholy-insights → Live Metrics |
| Log Analytics     | Portal → Log Analytics → workspace-sholyrg2PMR → Logs         |
| Cosmos DB Metrics | Portal → Cosmos DB → sholy-cosmos → Metrics                   |
| Redis Metrics     | Portal → Redis → sholy-redis → Metrics                        |
| All Alerts        | Portal → Monitor → Alerts                                     |

---

## Key Commands Reference

```bash
# View active revisions
az containerapp revision list --name sholy-backend --resource-group sholy-rg --output table

# View live logs
az containerapp logs show --name sholy-backend --resource-group sholy-rg --tail 50 --follow

# Roll back to previous revision
az containerapp ingress traffic set --name sholy-backend --resource-group sholy-rg --revision-weight <revision-name>=100

# Force new revision (picks up latest Key Vault secrets)
az containerapp update --name sholy-backend --resource-group sholy-rg --set-env-vars "FORCE_REDEPLOY=$(date +%s)"

# Check Redis keys
redis-cli -h sholy-redis.redis.cache.windows.net -p 6380 -a <key> --tls KEYS "*"
```
