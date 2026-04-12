const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    family: 4
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
