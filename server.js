require('dotenv').config();
const axios = require('axios');
const app = require('./src/app');
const logger = require('./src/utils/logger');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const PORT = process.env.PORT || 5000;


const server = app.listen(PORT, () => {
  logger.info('Server is running', { port: PORT });

  // 2. Add the Ping logic here
  // Note: Check your Render dashboard after deploying to see if your URL is exactly this!
  const RENDER_URL = "https://manual-distribution-backend.onrender.com/health"; 

  setInterval(() => {
    axios.get(RENDER_URL)
      .then(() => logger.info('Self-ping successful: Staying awake'))
      .catch((err) => logger.error('Self-ping failed', { message: err.message }));
  }, 840000); // 14 minutes
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise, reason });
  process.exit(1);
});

// Avoid logging raw environment secrets; only indicate presence.
console.log('EMAIL_USER set:', !!process.env.EMAIL_USER);

app.get('/test-email', async (req, res) => {
  const { sendManualEmail } = require('./src/utils/mailer');

  try {
    const result = await sendManualEmail({
      to: process.env.EMAIL_USER,
      subject: 'Manual App Test Email',
      html: '<h2>If you receive this email, Resend works.</h2>',
      pdfBuffer: null,
      filename: 'manual-app-test-email.html'
    });

    logger.info('EMAIL SENT', { result });
    res.send('Email sent successfully');
  } catch (error) {
    logger.error('EMAIL ERROR', { message: error.message, stack: error.stack });
    res.status(500).send('Email failed');
  }
});