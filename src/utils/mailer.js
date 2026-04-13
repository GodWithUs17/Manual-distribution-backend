const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: 587,
  secure: false, // Must be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use 16-character App Password here
  },
  pool: true,
  maxConnections: 3, // Lowered slightly to be more stable on free-tier hosting
  connectionTimeout: 40000, // Increased to 40s to handle slow network handshakes
  greetingTimeout: 40000,
  socketTimeout: 60000, // 60s to ensure the PDF buffer fully uploads
  tls: {
    family: 4, 
    rejectUnauthorized: false 
  }
});

// We keep the verify block but wrap it so it doesn't crash the startup
transporter.verify((error) => {
  if (error) {
    console.warn('⚠️ Mailer Verification Failed (Server will still run):', error.message);
  } else {
    console.log('✅ Mailer Ready');
  }
});

module.exports = transporter;