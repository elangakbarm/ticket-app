# Automatic journey completion

The core API reconciles journeys at startup and every minute. Schedules with
`arrivalTime <= now` and status SCHEDULED, BOARDING, DEPARTED, or DELAYED become
ARRIVED. Update arrivalTime when a delay changes the expected arrival. Cancelled
and soft-deleted schedules are excluded.

Within the same transaction, PAID and CONFIRMED bookings on ARRIVED schedules
become COMPLETED. This also repairs bookings on schedules already marked ARRIVED.
Unpaid, expired, and cancelled bookings retain their existing lifecycle. Ticket
validation/usage records are not changed by the clock.

Both booking API implementations reject cancellation once arrivalTime has elapsed
or the schedule is ARRIVED, for every role. Existing customer departure restrictions
still apply. The frontend checks the same rules every second, including an open
cancellation dialog. Booking details refresh every 15 seconds and COMPLETED badges
read "Trip completed".

## Release

Build and deploy the core API, booking service, and frontend together using the
target environment's existing release process. No schema migration is required.
The startup reconciliation updates existing elapsed journeys automatically.

Verify a paid/confirmed past-arrival booking becomes COMPLETED, its schedule becomes
ARRIVED, and cancellation returns JOURNEY_COMPLETED (or INVALID_BOOKING_STATUS for
an already completed booking). Verify a future booking retains its existing status
and a cancelled schedule is unchanged. In the browser, check booking details and the
train favicon at /favicon.svg.
