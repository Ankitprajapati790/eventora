const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');

const app = express();
const clientBuildPath = path.resolve(__dirname, '../client/dist');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'unavailable',
    database: databaseConnected ? 'connected' : 'disconnected'
  });
});
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuildPath, 'index.html')));
}

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be configured in production.');
    }

    const mongoUri = process.env.MONGO_URI || (process.env.NODE_ENV === 'production'
      ? ''
      : 'mongodb://127.0.0.1:27017/eventora');
    if (!mongoUri) {
      throw new Error('MONGO_URI must be configured in production.');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Eventora running on port ${PORT}`));
  } catch (error) {
    console.error('Eventora startup failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) startServer();

module.exports = app;
