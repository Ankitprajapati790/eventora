const assert = require('node:assert/strict');
const Event = require('../models/Event');

const event = new Event({
  title: 'QA Event',
  description: 'Demo event',
  date: '2026-10-18T00:00:00.000Z',
  time: '18:30',
  location: 'Mumbai',
  category: 'Technology',
  totalSeats: 50,
  availableSeats: 50,
  ticketPrice: 250,
  createdBy: '64b1d6da4a4d7d127f8a2d9b'
});

assert.equal(event.time, '18:30');
assert.ok(event.image && event.image.length > 0, 'Event image should be present');

console.log('event defaults test passed');
