const { Resend } = require('resend');

// Initialize Resend with your API Key from Render/Env
const resend = new Resend(process.env.RESEND_API_KEY);

const sendManualEmail = async ({ to, subject, html, pdfBuffer, filename }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: 'LAUTECH Manuals <onboarding@resend.dev>', // Keep this for testing
      to: [to],
      subject: subject,
      html: html,
      attachments: [
        {
          filename: filename,
          content: pdfBuffer, // Resend accepts the Buffer directly
        },
      ],
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return null;
    }

    console.log('✅ Email sent successfully via Resend:', data.id);
    return data;
  } catch (err) {
    console.error('❌ Unexpected Mailer Error:', err.message);
    return null;
  }
};

module.exports = { sendManualEmail };