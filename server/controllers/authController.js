const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt } = require('node:crypto');
const { sendOTPEmail } = require('../utils/email');

const generateOTP = () => randomInt(100000, 1000000).toString();

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const normalizedEmail = normalizeEmail(email);
        let user = await User.findOne({ email: normalizedEmail });
        if (user) {
            if (user.isVerified || !(await bcrypt.compare(password, user.password))) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const otp = generateOTP();
            await OTP.findOneAndDelete({ email: normalizedEmail, action: 'account_verification' });
            await OTP.create({ email: normalizedEmail, otp, action: 'account_verification' });
            await sendOTPEmail(normalizedEmail, otp, 'account_verification');
            return res.json({ message: 'OTP sent to email. Please verify.', email: normalizedEmail });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'user', // Hardcoded to prevent frontend passing role
            isVerified: false
        });

        const otp = generateOTP();
        await OTP.create({ email: normalizedEmail, otp, action: 'account_verification' });
        await sendOTPEmail(normalizedEmail, otp, 'account_verification');

        res.status(201).json({
            message: 'OTP sent to email. Please verify.',
            email: user.email
        });
    } catch (error) {
        if (error.code === 'EMAIL_DELIVERY_FAILED') {
            return res.status(502).json({ message: 'Unable to send the verification email. Please try again shortly.' });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified && user.role !== 'admin') {
            const otp = generateOTP();
            await OTP.findOneAndDelete({ email: user.email, action: 'account_verification' });
            await OTP.create({ email: user.email, otp, action: 'account_verification' });
            await sendOTPEmail(user.email, otp, 'account_verification');
            return res.status(403).json({ message: 'Account not verified', needsVerification: true, email: user.email });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        if (error.code === 'EMAIL_DELIVERY_FAILED') {
            return res.status(502).json({ message: 'Unable to send the verification email. Please try again shortly.' });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const validOTP = await OTP.findOne({ email: normalizeEmail(email), otp, action: 'account_verification' });

        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const user = await User.findOneAndUpdate({ email: normalizeEmail(email) }, { isVerified: true }, { new: true });
        await OTP.deleteOne({ _id: validOTP._id }); // Delete OTP after usage

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.requestAdminChange = async (req, res) => {
    try {
        const { currentEmail, currentPassword, newEmail, newPassword } = req.body;
        const normalizedCurrentEmail = normalizeEmail(currentEmail);
        const normalizedNewEmail = normalizeEmail(newEmail);

        if (!normalizedCurrentEmail || !normalizedNewEmail || !currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current admin email, current password, new email, and new password are required.' });
        }

        const adminUser = await User.findOne({ email: normalizedCurrentEmail, role: 'admin' });
        if (!adminUser) {
            return res.status(400).json({ message: 'Current admin account not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, adminUser.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current admin password is incorrect.' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedNewEmail)) {
            return res.status(400).json({ message: 'New admin email is invalid.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New admin password must be at least 6 characters long.' });
        }

        const duplicateUser = await User.findOne({ email: normalizedNewEmail, _id: { $ne: adminUser._id } });
        if (duplicateUser) {
            return res.status(400).json({ message: 'New admin email is already in use by another account.' });
        }

        const otp = generateOTP();
        await OTP.findOneAndDelete({ email: normalizedCurrentEmail, action: 'admin_change' });
        await OTP.create({
            email: normalizedCurrentEmail,
            otp,
            action: 'admin_change'
        });
        await sendOTPEmail(normalizedCurrentEmail, otp, 'admin_change');

        res.json({
            message: 'OTP sent to the current admin email. Verify it to change admin credentials.'
        });
    } catch (error) {
        if (error.code === 'EMAIL_DELIVERY_FAILED') {
            return res.status(502).json({ message: 'Unable to send the admin verification email. Please try again shortly.' });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.confirmAdminChange = async (req, res) => {
    try {
        const { currentEmail, otp, newEmail, newPassword } = req.body;
        const normalizedCurrentEmail = normalizeEmail(currentEmail);
        const normalizedNewEmail = normalizeEmail(newEmail);

        if (!normalizedCurrentEmail || !normalizedNewEmail || !otp || !newPassword) {
            return res.status(400).json({ message: 'Current email, OTP, new email, and new password are required.' });
        }

        const validOTP = await OTP.findOne({ email: normalizedCurrentEmail, otp, action: 'admin_change' });
        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired admin OTP.' });
        }

        const adminUser = await User.findOne({ email: normalizedCurrentEmail, role: 'admin' });
        if (!adminUser) {
            return res.status(400).json({ message: 'Current admin account not found.' });
        }

        const duplicateUser = await User.findOne({ email: normalizedNewEmail, _id: { $ne: adminUser._id } });
        if (duplicateUser) {
            return res.status(400).json({ message: 'New admin email is already in use.' });
        }

        const salt = await bcrypt.genSalt(10);
        adminUser.email = normalizedNewEmail;
        adminUser.password = await bcrypt.hash(newPassword, salt);
        adminUser.isVerified = true;
        await adminUser.save();
        await OTP.deleteOne({ _id: validOTP._id });

        res.json({
            message: 'Admin credentials updated successfully. Use the new admin email and password to sign in.'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
