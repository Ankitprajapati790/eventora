const express = require('express');
const router = express.Router();
const { register, login, verifyOTP, requestAdminChange, confirmAdminChange } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/request-admin-change', requestAdminChange);
router.post('/confirm-admin-change', confirmAdminChange);

module.exports = router;
