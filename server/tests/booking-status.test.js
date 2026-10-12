const assert = require('node:assert/strict');
const Booking = require('../models/Booking');
const { sendBookingStatusEmail } = require('../utils/email');
const { normalizePaymentStatus } = require('../controllers/bookingController');

const booking = new Booking({
  userId: '64b1d6da4a4d7d127f8a2d9b',
  eventId: '64b1d6da4a4d7d127f8a2d9c',
  status: 'cancelled',
  paymentStatus: 'not_paid',
  amount: 250,
  cancellationReason: 'No longer available on that date.'
});

assert.equal(booking.cancellationReason, 'No longer available on that date.');
assert.equal(typeof sendBookingStatusEmail, 'function');
assert.equal(normalizePaymentStatus('not_paid', 250), 'not_paid');
assert.equal(normalizePaymentStatus('paid', 250), 'paid');
assert.equal(normalizePaymentStatus('not_paid', 0), 'paid');

console.log('booking status helper tests passed');
