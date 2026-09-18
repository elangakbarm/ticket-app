# Python API performance test

Install the same dependency as the booking automation: `python -m pip install requests`.
Run commands from the repository root.

## 100 concurrent browsing clients

```powershell
python performance-test.py --users 100 --duration 60 --output performance-100.json
```

Paste an existing account's access token at the hidden prompt. Each virtual user has a separate HTTP session and makes one request at a time, cycling through profile, schedule search, schedule details, and seat availability. Existing schedule IDs come from search results. Empty results fall back to search. No registrations, bookings, payments, or schedules are created. Preflight checks the token before starting and is excluded from metrics.

Clients start over 10 seconds, then browse for another 60 seconds with a 1-second pause between requests. Duration excludes ramp-up; in-flight requests may finish after the deadline. Concurrency is virtual clients, not 100 requests every second. Shared credentials simulate concurrent sessions for one user, not distinct user data or frontend rendering.

```powershell
python performance-test.py --users 200 --duration 120 --ramp-up 20 --output performance-200.json
python performance-test.py --users 100 --duration 60 --ramp-up 0 --think-time 0 --output performance-burst.json
```

## 100 login attempts using one existing account

```powershell
python performance-test.py --mode login --users 100 --ramp-up 0 --email existing@example.com --output performance-login.json
```

The password is prompted securely. Each client attempts login exactly once, without retries. `--duration` and `--think-time` apply only to browsing. No new users are registered; successful login requests create the app's normal refresh-token and audit rows. Credentials, tokens, response bodies, and email addresses are not saved in the report. Browse mode requires a token valid for the entire run; it does not refresh tokens automatically.

## Read the results

The console and JSON report include completed requests, failures, successful and total throughput, HTTP status counts, and p50/p95/p99/max response times in milliseconds, overall and per endpoint. p95 means 95% of measured requests completed within that time. Latencies include unsuccessful responses, so check failures before interpreting a low percentile as good performance. Throughput includes ramp-up and request drain time. Ctrl+C stops new requests and saves completed results after in-flight requests finish.

The current Nest configuration sets 5 login attempts per minute and a default 100 requests per minute, normally keyed by client IP and handler. All clients on this machine share an IP, so expect HTTP 429 responses. Limits may also depend on proxy configuration and replicas. This test preserves those protections. To measure capacity beyond rate limiting, use a separate controlled test deployment with deliberately configured limits or distributed load generators. Do not interpret fast 429 responses as successful user traffic.

401 indicates invalid/expired credentials; 5xx indicates server errors; timeout and connection_error indicate requests that did not complete normally. Compare 100, 200, then higher client counts with separate report names, allowing limiter windows to reset. Watch server CPU, memory, database connections, and logs alongside the report: the client cannot measure those. A single-account workload can benefit from cached/shared user data and does not prove performance with 100 distinct accounts. Larger thread counts also depend on the load-generator computer's resources.

Exit codes: 0 = all measured requests succeeded; 1 = request failures or no completed requests; 130 = interrupted. The default output file is overwritten on each run; use `--output` to preserve comparisons.

## Configure the API for a browsing capacity test

The API now reads `THROTTLE_LIMIT` (default `100`) and `THROTTLE_TTL_MS` (default `60000`) at startup. Both must be positive integers. For a local test, start the API in one PowerShell terminal:

```powershell
$env:THROTTLE_LIMIT = '10000'
$env:THROTTLE_TTL_MS = '60000'
npm run start:dev
```

Then run the Python test in a second terminal. Alternatively, set these values in the test deployment's `.env` or container environment and restart/recreate the API. Changing the Python terminal's environment does not update an already-running API. The 10000 setting is a test allowance per IP and endpoint handler, not a demonstrated capacity or a production recommendation. Login still uses its separate 5 attempts per minute limit. Restore the default settings after the capacity test.
