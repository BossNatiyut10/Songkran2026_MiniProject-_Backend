const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const giftRoutes = require('./routes/gift');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' })); // Vite default port
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gift', giftRoutes);

// Health check
app.get('/', (req, res) => res.json({ message: 'Songkran API running' }));

// Connect to MongoDB then start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error('MongoDB connection error:', err));
