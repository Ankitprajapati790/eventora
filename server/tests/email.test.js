const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

process.env.RESEND_API_KEY = 're_test_key';
process.env.EMAIL_FROM = 'Eventora <notifications@example.com>';

const { sendOTPEmail, sendBookingStatusEmail } = require('../utils/email');
const originalFetch = global.fetch;

afterEach(() => {
    global.fetch = originalFetch;
});

test('sends verification OTP to the requested recipient through Resend', async () => {
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true };
    };

    await sendOTPEmail('attendee@example.com', '123456', 'account_verification');

    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.method, 'POST');
    assert.match(request.options.headers.Authorization, /^Bearer /);
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.from, 'Eventora <notifications@example.com>');
    assert.deepEqual(payload.to, ['attendee@example.com']);
    assert.equal(payload.subject, 'Verify your Eventora Account');
    assert.match(payload.html, /123456/);
});

test('reports rejected provider requests instead of silently succeeding', async () => {
    let loggedMessage = '';
    const originalError = console.error;
    console.error = (message) => {
        loggedMessage = message;
    };
    global.fetch = async () => ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'The sender domain is not verified.' })
    });

    try {
        await assert.rejects(
            sendBookingStatusEmail('attendee@example.com', 'Attendee', 'Live Event', 'confirmed'),
            {
                code: 'EMAIL_DELIVERY_FAILED',
                message: 'Email provider rejected the message (HTTP 403).',
                providerMessage: 'The sender domain is not verified.'
            }
        );
        assert.match(loggedMessage, /The sender domain is not verified\./);
    } finally {
        console.error = originalError;
    }
});
