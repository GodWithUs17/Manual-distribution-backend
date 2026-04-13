// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: 465,
//   secure: true, 
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   // --- ADDED SETTINGS FOR RELIABILITY ---
//   connectionTimeout: 20000, // 10 seconds - stops the infinite "ETIMEDOUT"
//   greetingTimeout: 20000,   // 10 seconds
//   socketTimeout: 20000,     // 15 seconds
//   pool: true,               // Uses a pooled connection (faster for multiple students)
//   maxConnections: 5,        // Limit connections to avoid Gmail spam blocks
//   tls: {
//     family: 4,              // Keep this - fixes IPv6 issues
//     rejectUnauthorized: false // Helps if there are certificate handshake issues on Render
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
  port: 587,         // Changed from 465
  secure: false,      // Changed from true (Port 587 uses STARTTLS, so secure must be false)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // --- ENHANCED RELIABILITY ---
  pool: true,         
  maxConnections: 5,  
  maxMessages: 100,
  connectionTimeout: 20000, 
  greetingTimeout: 20000,   
  socketTimeout: 30000,     // Increased slightly for PDF attachments
  tls: {
    family: 4,              
    rejectUnauthorized: false 
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ MAILER ERROR:', error);
  } else {
    console.log('✅ Mail server is ready to send manuals');
  }
});

module.exports = transporter;