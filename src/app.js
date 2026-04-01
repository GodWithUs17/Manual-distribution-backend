const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./utils/prisma');
const authRoutes = require('./routes/authRoutes');
const manualRoutes = require('./routes/manualRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const adminRoutes = require('./routes/adminRoutes');
const app = express();

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/purchases', purchaseRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use("/uploads", express.static("uploads"));
app.get('/', async (req, res) => {
  try {
    console.log('Attempting to fetch manuals...');
    const manuals = await prisma.manual.findMany();
    console.log(`Successfully fetched ${manuals.length} manuals`);
    res.json({ message: 'Manual Distribution Backend API is running', manualsCount: manuals.length });
  } catch (error) {
    console.error('ERROR fetching manuals:');
    console.error('  Message:', error.message);
    console.error('  Code:', error.code);
    console.error('  Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch manuals', details: error.message });
  }
});

// A simple health check route
app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and awake!');
});

module.exports = app;