const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('./utils/prisma');
const authRoutes = require('./routes/authRoutes');
const manualRoutes = require('./routes/manualRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const adminRoutes = require('./routes/adminRoutes');
const app = express();
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'https://manual-distribution-frontend.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Required if you are sending tokens/cookies
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use('/api/purchases/paystack-webhook', express.raw({ type: 'application/json' }));
app.use('/api/purchases/flutterwave-webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/purchases', purchaseRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use("/uploads", express.static("uploads"));
app.get('/', async (req, res) => {
  try {
    logger.info('Attempting to fetch manuals');
    const manuals = await prisma.manual.findMany();
    logger.info('Fetched manuals', { count: manuals.length });
    res.json({ message: 'Manual Distribution Backend API is running', manualsCount: manuals.length });
  } catch (error) {
    logger.error('ERROR fetching manuals', { message: error.message, code: error.code, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch manuals', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and awake!');
});

app.use(errorHandler);

module.exports = app;