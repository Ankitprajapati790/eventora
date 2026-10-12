const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

process.env.RESEND_API_KEY = 're_test_key';
process.env.EMAIL_FROM = 'Eventora <notifications@example.com>';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { register } = require('../controllers/authController');

const originalFetch = global.fetch;
const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalDeleteOTP = OTP.findOneAndDelete;
const originalCreateOTP = OTP.create;

afterEach(() => {
    global.fetch = originalFetch;
    User.findOne = originalFindOne;
    User.create = originalCreate;
    OTP.findOneAndDelete = originalDeleteOTP;
    OTP.create = originalCreateOTP;
});

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test('retrying an unverified signup updates its password and sends another OTP', async () => {
    const pendingUser = {
        name: 'Earlier Name',
        email: 'attendee@example.com',
        password: await bcrypt.hash('previous-password', 4),
        isVerified: false,
        save: async () => {}
    };
    let sentMessage;
    User.findOne = async () => pendingUser;
    User.create = async () => {
        throw new Error('Should reuse the pending account');
    };
    OTP.findOneAndDelete = async () => {};
    OTP.create = async () => {};
    global.fetch = async (url, options) => {
        sentMessage = { url, payload: JSON.parse(options.body) };
        return { ok: true };
    };

    const response = createResponse();
    await register({
        body: {
            name: 'Updated Name',
            email: 'ATTENDEE@example.com',
            password: 'replacement-password'
        }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.email, 'attendee@example.com');
    assert.equal(pendingUser.name, 'Updated Name');
    assert.equal(await bcrypt.compare('replacement-password', pendingUser.password), true);
    assert.equal(sentMessage.payload.to[0], 'attendee@example.com');
    assert.equal(sentMessage.payload.subject, 'Verify your Eventora Account');
});

test('signup with an already verified email returns invalid credentials', async () => {
    User.findOne = async () => ({ isVerified: true });

    const response = createResponse();
    await register({
        body: {
            name: 'Attendee',
            email: 'attendee@example.com',
            password: 'incorrect-password'
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { message: 'Invalid credentials' });
});
