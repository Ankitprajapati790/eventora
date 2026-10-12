const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const createAdmin = async () => {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';

    if (!email || password.length < 12) {
        throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.');
    }
    if (!process.env.MONGO_URI) {
        throw new Error('Set MONGO_URI before creating the initial admin.');
    }

    await mongoose.connect(process.env.MONGO_URI);

    if (await User.exists({ role: 'admin' })) {
        throw new Error('An admin account already exists; refusing to create another.');
    }
    if (await User.exists({ email })) {
        throw new Error('An account with ADMIN_EMAIL already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
        name: process.env.ADMIN_NAME?.trim() || 'Eventora Admin',
        email,
        password: hashedPassword,
        role: 'admin',
        isVerified: true
    });

    console.log(`Initial admin created for ${email}.`);
};

createAdmin()
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
        console.error('Admin setup failed:', error.message);
        await mongoose.disconnect();
        process.exitCode = 1;
    });