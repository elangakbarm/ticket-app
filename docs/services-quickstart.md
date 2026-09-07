# Run bookings and payments through ticket-app

ticket-app is now the public entry point for these routes. Its AppModule no longer
registers the original BookingsModule or PaymentsModule, so their local controllers,
business services and booking cron job do not run. Existing source files remain for
reference and DTO reuse. ServiceGatewayModule registers HTTP forwarding controllers
at the same paths. Restart ticket-app to apply this change.

| App | Directory | Default port |
| --- | --- | --- |
| Main API / gateway | D:\ticket-app | 3000 |
| Payments | D:\ticket-service-payments | 3001 |
| Bookings | D:\ticket-service-bookings | 3002 |

All three currently share PostgreSQL and the same JWT access secret. Authentication,
schedules, seats, tickets and dashboard endpoints still run in ticket-app. Payments
issues tickets; bookings owns the expiry scheduler, cancellation and seat holds.
This is a process separation, not yet an independent database per service.

## 1. Configure the apps

Use Node 22.12+ and your existing migrated ticket-app database. Create `.env` from
`.env.example` in each new service if it does not exist; do not overwrite a configured
file. Set the same DATABASE_URL and JWT_ACCESS_SECRET in all three apps. Keep the
existing JWT_REFRESH_SECRET in ticket-app. Only ticket-app issues login tokens.

In `D:\ticket-app\.env`, add:

```dotenv
BOOKINGS_SERVICE_URL=http://localhost:3002/api/v1
PAYMENTS_SERVICE_URL=http://localhost:3001/api/v1
SERVICE_HTTP_TIMEOUT_MS=20000
```

Set PORT=3001 in payments and PORT=3002 in bookings. Set BOOKING_HOLD_MINUTES=10
(or your desired positive integer) in bookings. The main app's old hold setting no
longer controls booking creation. Swagger is enabled by SWAGGER_ENABLED=true.

Service URLs include `/api/v1`. They are fixed configuration, not supplied by clients.
Do not set them to ticket-app itself, which would cause a forwarding loop.

## 2. Start payments in terminal 1

```powershell
cd D:\ticket-service-payments
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd start
```

The Prisma CLI loads the database URL from the service's `.env`.
Do not run new migrations from either extracted service; ticket-app owns the shared schema.

## 3. Start bookings in terminal 2

```powershell
cd D:\ticket-service-bookings
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd start
```

Bookings' Prisma config loads its `.env`. Run one bookings instance while using the
in-process hourly scheduler; coordinating multiple workers is a separate deployment step.

## 4. Restart ticket-app in terminal 3

Stop its previous development process with Ctrl+C in that terminal, then run:

```powershell
cd D:\ticket-app
npm.cmd run build
npm.cmd run start:prod
```

For development, use `npm.cmd run start:dev` instead. Restart any other old ticket-app
replicas too so none still execute the original modules or scheduler.

Check service readiness in a fourth terminal:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health/ready
Invoke-RestMethod http://localhost:3002/api/v1/health/ready
```

## 5. Login through ticket-app

Use your existing account (or register through POST /api/v1/auth/register first).
All remaining requests below use port **3000**, not the downstream ports.

```powershell
$base = 'http://localhost:3000/api/v1'
$loginBody = @{ email = 'YOUR_EMAIL'; password = 'YOUR_PASSWORD' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
```

## 6. Select an available schedule and seat

```powershell
Invoke-RestMethod "$base/schedules" | ConvertTo-Json -Depth 10
$scheduleId = 'REPLACE_WITH_SCHEDULE_PUBLIC_ID'
Invoke-RestMethod "$base/schedules/$scheduleId/seats" | ConvertTo-Json -Depth 10
$seatId = 'REPLACE_WITH_AVAILABLE_SEAT_PUBLIC_ID'
```

Choose a future schedule and an available seat. Use public IDs, not numeric IDs.

## 7. Create a booking through the gateway

```powershell
$bookingBody = @{
  schedulePublicId = $scheduleId
  seats = @(@{
    seatPublicId = $seatId
    passenger = @{
      fullName = 'Test Passenger'
      identityType = 'KTP'
      identityNumber = '3174000000000001'
      dateOfBirth = '1998-01-01'
      passengerType = 'ADULT'
    }
  })
} | ConvertTo-Json -Depth 6
$booking = Invoke-RestMethod -Method Post -Uri "$base/bookings" -Headers $headers -ContentType 'application/json' -Body $bookingBody
$bookingCode = $booking.data.bookingCode
Invoke-RestMethod "$base/bookings/$bookingCode" -Headers $headers
```

ticket-app forwards this to bookings on port 3002. The returned amount and hold deadline
come from that service. Complete the following steps before the hold expires.

## 8. Create and confirm payment through the gateway

```powershell
$paymentBody = @{ paymentMethod = 'BANK_TRANSFER'; amount = $booking.data.totalAmount } | ConvertTo-Json
$payment = Invoke-RestMethod -Method Post -Uri "$base/bookings/$bookingCode/payments" -Headers $headers -ContentType 'application/json' -Body $paymentBody
$reference = $payment.data.paymentReference
$confirmHeaders = @{
  Authorization = $headers.Authorization
  'idempotency-key' = [guid]::NewGuid().ToString()
}
$confirmed = Invoke-RestMethod -Method Post -Uri "$base/payments/$reference/confirm" -Headers $confirmHeaders
$confirmed | ConvertTo-Json -Depth 10
Invoke-RestMethod "$base/payments/$reference" -Headers $headers
Invoke-RestMethod "$base/bookings/$bookingCode" -Headers $headers
```

These payment calls go to port 3001. Confirmation is still a mock operation; it marks
the payment paid, confirms the booking and issues tickets in the shared database.
Reuse `$confirmHeaders` unchanged to retry confirmation with the same idempotency key.

## Other routes

| Method | Gateway path (after /api/v1) | Owner |
| --- | --- | --- |
| POST | /bookings | Bookings |
| GET | /bookings?page=1&limit=20 | Bookings |
| GET | /bookings/:bookingCode | Bookings |
| PATCH | /bookings/:bookingCode/cancel | Bookings |
| POST | /bookings/:bookingCode/passengers | Bookings |
| POST | /bookings/:bookingCode/payments | Payments |
| GET | /payments/:paymentReference | Payments |
| POST | /payments/:paymentReference/confirm | Payments |
| POST | /payments/:paymentReference/fail | Payments |

Cancel body: `{ "reason": "Changed plans" }`. Add-passenger body:
`{ "passenger": { ...same fields as the passenger above... } }`.
Fail has no body and only accepts a pending payment. Do not fail the payment you just confirmed.

Swagger at http://localhost:3000/api/docs can call both services through ticket-app:
login, click Authorize, paste the access token, then use Bookings and Payments operations.

## Caller behavior and troubleshooting

ServiceCaller is exported by ServiceGatewayModule for future controllers. It forwards
only Authorization, idempotency-key and x-correlation-id request headers, the validated
DTO body, and list query parameters. Both hops authenticate the JWT. Upstream status,
JSON envelope and Retry-After are preserved. There is no local business fallback and
no automatic retry of mutations. A timeout may happen after a remote commit; inspect
booking/payment state before retrying creation, and reuse confirmation's idempotency key.

- 401: log in again; verify all apps use the same JWT_ACCESS_SECRET and database.
- 502: check service processes, configured URLs and readiness; invalid JSON or redirects also produce 502.
- 504: remote response exceeded SERVICE_HTTP_TIMEOUT_MS (default 20 seconds).
- Booking expired/seat unavailable/amount mismatch: business validation reached the owning service.

Use host.docker.internal to reach host processes from Docker Desktop, or container
service names on a shared Docker network. localhost inside a container means that container.
No live database writes or end-to-end purchase were performed during this extraction.
