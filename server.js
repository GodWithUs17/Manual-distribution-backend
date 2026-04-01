require ('dotenv').config();
const axios = require('axios');
const app = require('./src/app');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const PORT = process.env.PORT || 5000;


const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // 2. Add the Ping logic here
  // Note: Check your Render dashboard after deploying to see if your URL is exactly this!
  const RENDER_URL = "https://manual-app-backend.onrender.com/health"; 

  setInterval(() => {
    axios.get(RENDER_URL)
      .then(() => console.log("Self-ping successful: Staying awake!"))
      .catch((err) => console.error("Self-ping failed:", err.message));
  }, 840000); // 14 minutes
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log("EMAIL USER:", process.env.EMAIL_USER);

app.get('/test-email', async (req, res) => {
  const transporter = require('./src/utils/mailer');

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, 
      subject: 'Manual App Test Email',
      html: '<h2>If you receive this email, Nodemailer works.</h2>'
    });

    console.log('EMAIL SENT:', info.response);
    res.send('Email sent successfully');
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    res.status(500).send('Email failed');
  }
});