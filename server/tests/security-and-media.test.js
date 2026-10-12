const assert = require('node:assert/strict');
const { escapeRegex, resolveEventImage, getAdminCredentialHint } = require('../utils/securityAndMedia');

assert.equal(resolveEventImage(''), 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80');
assert.equal(resolveEventImage('https://example.com/event.jpg'), 'https://example.com/event.jpg');
assert.equal(escapeRegex('meet.*(today)'), 'meet\\.\\*\\(today\\)');
assert.equal(getAdminCredentialHint(), null);

console.log('security and media test passed');
