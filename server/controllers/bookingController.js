const Booking = require('../models/Booking');
const Event = require('../models/Event');
const OTP = require('../models/OTP');
const { randomInt } = require('node:crypto');
const { sendBookingEmail, sendBookingStatusEmail, sendOTPEmail } = require('../utils/email');

const generateOTP = () => randomInt(100000, 1000000).toString();
const normalizePaymentStatus = (paymentStatus, amount) => (
    Number(amount) === 0 || paymentStatus !== 'not_paid' ? 'paid' : 'not_paid'
);
const sendNotification = async (send) => {
    try {
        await send();
        return null;
    } catch (error) {
        if (error.code !== 'EMAIL_DELIVERY_FAILED') throw error;
        console.error('Booking notification email failed:', error.message);
        const providerDetails = error.providerMessage ? ` Provider: ${error.providerMessage}` : '';
        return `The booking was updated, but its notification email could not be delivered.${providerDetails}`;
    }
};

exports.sendBookingOTP = async (req, res) => {
    try {
        const otp = generateOTP();
        await OTP.findOneAndDelete({ email: req.user.email, action: 'event_booking' });
        await OTP.create({ email: req.user.email, otp, action: 'event_booking' });
        await sendOTPEmail(req.user.email, otp, 'event_booking');
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        if (error.code === 'EMAIL_DELIVERY_FAILED') {
            return res.status(502).json({
                message: 'Unable to send the booking verification email. Please try again shortly.',
                ...(error.providerMessage && { emailProviderMessage: error.providerMessage })
            });
        }
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
};

exports.bookEvent = async (req, res) => {
    try {
        const { eventId, otp } = req.body;

        const validOTP = await OTP.findOne({ email: req.user.email, otp, action: 'event_booking' });
        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP for booking' });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        if (event.availableSeats <= 0) return res.status(400).json({ message: 'No seats available' });

        const existingBooking = await Booking.findOne({ userId: req.user.id, eventId });
        if (existingBooking && existingBooking.status !== 'cancelled') {
            return res.status(400).json({ message: 'Already booked or pending' });
        }

        const booking = await Booking.create({
            userId: req.user.id,
            eventId,
            status: 'pending',
            paymentStatus: 'not_paid',
            amount: event.ticketPrice
        });

        await OTP.deleteOne({ _id: validOTP._id });
        const emailWarning = await sendNotification(() => sendBookingStatusEmail(
            req.user.email,
            req.user.name,
            event.title,
            'pending',
            'Your booking request is awaiting admin approval.',
            { date: event.date, location: event.location }
        ));

        res.status(201).json({
            message: 'Booking request submitted',
            booking,
            ...(emailWarning && { emailWarning })
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.confirmBooking = async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        if (paymentStatus && !['paid', 'not_paid'].includes(paymentStatus)) {
            return res.status(400).json({ message: 'Payment status must be paid or not_paid' });
        }

        const booking = await Booking.findById(req.params.id).populate('userId').populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.status === 'confirmed') return res.status(400).json({ message: 'Booking is already confirmed' });

        const event = await Event.findById(booking.eventId._id);
        if (!event) return res.status(404).json({ message: 'Event no longer exists' });
        if (event.availableSeats <= 0) {
            return res.status(400).json({ message: 'No seats available to confirm this booking' });
        }

        booking.status = 'confirmed';
        booking.paymentStatus = normalizePaymentStatus(paymentStatus, booking.amount);
        await booking.save();

        event.availableSeats -= 1;
        await event.save();

        const emailWarning = await sendNotification(() => sendBookingEmail(
            booking.userId.email,
            booking.userId.name,
            booking.eventId,
            booking.paymentStatus || 'paid'
        ));

        res.json({
            message: 'Booking confirmed successfully',
            booking,
            ...(emailWarning && { emailWarning })
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        const bookings = req.user.role === 'admin'
            ? await Booking.find().populate('eventId').populate('userId', 'name email').sort({ createdAt: -1 })
            : await Booking.find({ userId: req.user.id }).populate('eventId').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        let emailWarning = null;
        const booking = await Booking.findById(req.params.id).populate('userId').populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        const bookingOwnerId = booking.userId?._id ? booking.userId._id.toString() : booking.userId?.toString();
        if (bookingOwnerId !== req.user.id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (booking.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });

        const wasConfirmed = booking.status === 'confirmed';
        const reason = req.body?.reason || req.body?.cancellationReason || 'No reason provided';

        booking.status = 'cancelled';
        booking.cancellationReason = reason;
        await booking.save();

        if (wasConfirmed) {
            const event = await Event.findById(booking.eventId);
            if (event) {
                event.availableSeats += 1;
                await event.save();
            }
        }

        if (booking.userId && booking.eventId) {
            emailWarning = await sendNotification(() => sendBookingStatusEmail(
                booking.userId.email,
                booking.userId.name,
                booking.eventId.title,
                'cancelled',
                reason,
                { date: booking.eventId.date, location: booking.eventId.location }
            ));
        }

        res.json({
            message: 'Booking cancelled successfully',
            ...(emailWarning && { emailWarning })
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.normalizePaymentStatus = normalizePaymentStatus;
