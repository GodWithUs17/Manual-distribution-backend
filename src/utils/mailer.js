// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: 465,
//   secure: true, // true for 465, false for other ports
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   tls: {
//     family: 4
//   }
// });

// transporter.verify((error, success) => {
//   if (error) {
//     console.error('❌ MAILER ERROR:', error);
//   } else {
//     console.log('✅ Mail server is ready to send emails');
//   }
// });

// module.exports = transporter;

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // --- ADDED SETTINGS FOR RELIABILITY ---
  connectionTimeout: 10000, // 10 seconds - stops the infinite "ETIMEDOUT"
  greetingTimeout: 10000,   // 10 seconds
  socketTimeout: 15000,     // 15 seconds
  pool: true,               // Uses a pooled connection (faster for multiple students)
  maxConnections: 5,        // Limit connections to avoid Gmail spam blocks
  tls: {
    family: 4,              // Keep this - fixes IPv6 issues
    rejectUnauthorized: false // Helps if there are certificate handshake issues on Render
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ MAILER ERROR:', error);
  } else {
    console.log('✅ Mail server is ready to send emails');
  }
});

module.exports = transporter;