const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const base = 'http://localhost:3000/api/v1';
let token;
async function api(path, method = 'GET', body, extra = {}) {
  const response = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(result)}`);
  return result.data;
}
async function main() {
  assert(new URL(process.env.DATABASE_URL).hostname === 'host.docker.internal' && new URL(process.env.DATABASE_URL).pathname === '/ticket_app', 'Run only against the local host ticket_app database');
  const id = randomUUID().slice(0, 8);
  const email = `docker-smoke-${id}@example.com`;
  const password = randomUUID() + 'Aa1!';
  await api('/auth/register', 'POST', { fullName: 'Docker Smoke Test', email, password });
  const login = await api('/auth/login', 'POST', { email, password });
  token = login.accessToken;
  assert(token, 'Login must issue an access token');
  const fixture = await db.$transaction(async tx => {
    const origin = await tx.station.create({ data: { code: `SMO-${id}`, name: 'Smoke Origin', city: 'Jakarta', province: 'DKI Jakarta' } });
    const destination = await tx.station.create({ data: { code: `SMD-${id}`, name: 'Smoke Destination', city: 'Bandung', province: 'Jawa Barat' } });
    const route = await tx.route.create({ data: { routeCode: `SMR-${id}`, originStationId: origin.id, destinationStationId: destination.id, distanceKm: 150, estimatedDurationMinutes: 120 } });
    const train = await tx.train.create({ data: { trainCode: `SMT-${id}`, name: 'Docker Smoke Train', trainClass: 'ECONOMY', totalSeats: 1 } });
    const seat = await tx.seat.create({ data: { trainId: train.id, carriageNumber: 1, seatNumber: 'A1', seatClass: 'ECONOMY' } });
    const schedule = await tx.schedule.create({ data: { scheduleCode: `SMS-${id}`, trainId: train.id, routeId: route.id, departureTime: new Date(Date.now() + 7 * 86400000), arrivalTime: new Date(Date.now() + 7 * 86400000 + 7200000), basePrice: 100000 } });
    return { seat, schedule };
  });
  await api(`/schedules/${fixture.schedule.publicId}/seats`);
  const booking = await api('/bookings', 'POST', {
    schedulePublicId: fixture.schedule.publicId,
    seats: [{ seatPublicId: fixture.seat.publicId, passenger: { fullName: 'Test Passenger', identityType: 'KTP', identityNumber: '3174000000000001', dateOfBirth: '1998-01-01', passengerType: 'ADULT' } }],
  });
  assert.equal(booking.status, 'PENDING_PAYMENT');
  const payment = await api(`/bookings/${booking.bookingCode}/payments`, 'POST', { paymentMethod: 'BANK_TRANSFER', amount: Number(booking.totalAmount) });
  const headers = { 'idempotency-key': randomUUID() };
  await api(`/payments/${payment.paymentReference}/confirm`, 'POST', undefined, headers);
  await api(`/payments/${payment.paymentReference}/confirm`, 'POST', undefined, headers);
  const paid = await api(`/payments/${payment.paymentReference}`);
  const confirmed = await api(`/bookings/${booking.bookingCode}`);
  assert.equal(paid.status, 'PAID');
  assert.equal(confirmed.status, 'CONFIRMED');
  const tickets = await api('/tickets');
  assert.equal(tickets.length, 1, 'Confirmation retry must issue exactly one ticket');
  assert.equal(tickets[0].status, 'ACTIVE');
  console.log(JSON.stringify({ result: 'PASS', email, bookingCode: booking.bookingCode, paymentReference: payment.paymentReference, bookingStatus: confirmed.status, paymentStatus: paid.status, ticketNumber: tickets[0].ticketNumber, checks: ['registration', 'login', 'schedule seats', 'gateway booking', 'gateway payment', 'confirmation retry', 'ticket issuance'] }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
