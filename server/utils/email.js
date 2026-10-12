const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const emailUser = (process.env.EMAIL_USER || '').trim();
const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const emailFrom = (process.env.EMAIL_FROM || emailUser).trim();
const resendApiKey = (process.env.RESEND_API_KEY || '').trim();

if (process.env.NODE_ENV === 'production' && !resendApiKey && (!emailUser || !emailPass)) {
    throw new Error('Configure RESEND_API_KEY and EMAIL_FROM, or EMAIL_USER and EMAIL_PASS, in production.');
}

if (process.env.NODE_ENV === 'production' && resendApiKey && !emailFrom) {
    throw new Error('EMAIL_FROM must be configured when using Resend in production.');
}

const transporter = emailUser && emailPass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    })
    : null;

class EmailDeliveryError extends Error {
    constructor(message, cause, providerMessage = '') {
        super(message, { cause });
        this.name = 'EmailDeliveryError';
        this.code = 'EMAIL_DELIVERY_FAILED';
        this.providerMessage = providerMessage;
    }
}

const sendEmail = async ({ to, subject, html }) => {
    if (resendApiKey) {
        let response;
        try {
            response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ from: emailFrom, to: [to], subject, html }),
                signal: AbortSignal.timeout(10000)
            });
        } catch (error) {
            const message = error.name === 'TimeoutError'
                ? 'Email provider did not respond within 10 seconds.'
                : 'Could not connect to the email provider.';
            throw new EmailDeliveryError(message, error);
        }

        if (!response.ok) {
            const responseBody = await response.text();
            let providerMessage = '';
            try {
                const details = JSON.parse(responseBody);
                providerMessage = typeof details.message === 'string' ? details.message : '';
            } catch {
                providerMessage = responseBody;
            }
            providerMessage = providerMessage.replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
            console.error(
                `Email provider rejected a message (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : ''}`
            );
            throw new EmailDeliveryError(
                `Email provider rejected the message (HTTP ${response.status}).`,
                undefined,
                providerMessage
            );
        }
        return;
    }

    if (transporter && emailFrom) {
        try {
            await transporter.sendMail({ from: emailFrom, to, subject, html });
            return;
        } catch (error) {
            throw new EmailDeliveryError('SMTP could not deliver the email. Check the email credentials and provider network settings.', error);
        }
    }

    if (process.env.NODE_ENV === 'production') {
        throw new EmailDeliveryError('Email delivery is not configured.');
    }

    console.warn(`Email credentials are not configured. Skipping email to ${to}.`);
};

const sendBookingStatusEmail = async (userEmail, userName, eventTitle, status, reason = '', eventDetails = {}) => {
    const normalizedStatus = status === 'cancelled' ? 'cancelled' : status === 'confirmed' ? 'confirmed' : 'pending';
    const statusLabel = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
    const dateText = eventDetails.date ? `<p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(eventDetails.date).toLocaleString()}</p>` : '';
    const locationText = eventDetails.location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${eventDetails.location}</p>` : '';
    const paymentText = eventDetails.paymentStatus ? `<p style="margin: 8px 0;"><strong>Payment Status:</strong> ${eventDetails.paymentStatus.replace('_', ' ')}</p>` : '';
    const reasonText = reason ? `<p style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</p>` : '';
    const isRejected = normalizedStatus === 'cancelled';

    await sendEmail({
        to: userEmail,
        subject: isRejected ? `Booking Update: ${eventTitle} was not approved` : normalizedStatus === 'confirmed' ? `Booking Confirmed: ${eventTitle}` : `Booking Update: ${eventTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #e5e7eb; color: #111827;">
                <div style="background: linear-gradient(135deg, #111827, #374151); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0; margin: -24px -24px 20px;">
                    <h2 style="margin: 0; font-size: 24px;">Eventora</h2>
                </div>
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #111827;">Hello ${userName},</h3>
                <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Your booking for <strong>${eventTitle}</strong> has been <strong>${isRejected ? 'not approved' : statusLabel.toLowerCase()}</strong>.
                </p>
                ${dateText}
                ${locationText}
                ${paymentText}
                ${reasonText}
                <p style="margin-top: 16px; line-height: 1.6;">
                    ${isRejected
                        ? 'We appreciate your interest and encourage you to explore other upcoming events on Eventora.'
                        : 'Thank you for choosing Eventora. We look forward to welcoming you at the event.'}
                </p>
                <p style="margin-top: 24px; color: #4b5563;">Best regards,<br/>The Eventora Team</p>
            </div>
        `
    });
};

const sendBookingEmail = async (userEmail, userName, event, paymentStatus = 'paid') => {
    const eventTitle = typeof event === 'string' ? event : event?.title || 'Eventora Event';
    const eventDetails = typeof event === 'object' && event ? event : {};
    await sendBookingStatusEmail(userEmail, userName, eventTitle, 'confirmed', '', { ...eventDetails, paymentStatus });
};

const sendOTPEmail = async (userEmail, otp, type) => {
    if (!resendApiKey && !transporter && process.env.NODE_ENV !== 'production') {
        console.info(`Development OTP for ${userEmail} (${type}): ${otp}`);
        return;
    }

    const title = type === 'account_verification'
        ? 'Verify your Eventora Account'
        : type === 'admin_change'
            ? 'Verify Admin Credential Update'
            : 'Eventora Booking Verification';
    const msg = type === 'account_verification'
        ? 'Please use the following OTP to verify your new Eventora account.'
        : type === 'admin_change'
            ? 'Please use the following OTP to verify the admin credential change request.'
            : 'Please use the following OTP to verify and confirm your event booking.';

    await sendEmail({
        to: userEmail,
        subject: title,
        html: `
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <h2 style="color: #111;">${title}</h2>
                <p style="color: #555; font-size: 16px;">${msg}</p>
                <div style="margin: 20px auto; padding: 15px; font-size: 24px; font-weight: bold; background: #f4f4f4; width: max-content; letter-spacing: 5px;">
                    ${otp}
                </div>
                <p style="color: #999; font-size: 12px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
            </div>
        `
    });
};

module.exports = { sendBookingEmail, sendBookingStatusEmail, sendOTPEmail, EmailDeliveryError };
