const prisma = require('../utils/prisma');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid')
const QRCode = require('qrcode');
const axios = require('axios');
const transporter = require('../utils/mailer')
const PDFDocument = require('pdfkit');
const path = require('path');



// mark manual as collected (STAFF only)
const markCollected = async (req, res) => {
  const { reference } = req.body; // This is the qrToken scanned from the QR code

  try {
    console.log("LOGGED IN STAFF:", req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Staff ID not found in security token' });
    }

    // 1. Find and update in one go if possible, or verify first
    const purchase = await prisma.purchase.findFirst({
      where: { qrToken: reference }, // Search by qrToken, not transactionRef
    });

    if (!purchase || purchase.status !== 'paid') {
      return res.status(404).json({ error: 'Purchase not found or not paid' });
    }

    if (purchase.collected) {
      return res.status(400).json({ error: 'Manual already marked as collected' });
    }

    // 2. Perform the update
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        collected: true,
        collectedAt: new Date(),
        collectedById: req.user.id,
        issuedBy: req.user.name 
      }
    });

    return res.json({ message: 'Manual marked as collected successfully' });
    
  } catch (error) {
    return res.status(500).json({ error: 'Database update failed' });
  }
};



// server/controllers/purchaseController.js
const verifyQR = async (req, res) => {
  const { reference } = req.params; // This captures "T7493..." from the URL

  try {
    const purchase = await prisma.purchase.findFirst({
      where: {
        OR: [
          { transactionRef: reference }, // Check the Paystack Ref
          { qrToken: reference }        // Check the unique QR Token
        ]
      },
      include: { 
        manual: true // This gets the Manual name/details
      }
    });

    if (!purchase) {
      return res.status(404).json({ 
        status: "INVALID", 
        error: "Student record not found." 
      });
    }

    if (purchase.collected) {
      return res.status(400).json({ error: 'Manual already marked as collected' });
    }

    // Optional: Check if the student has actually paid
    if (purchase.status !== 'success' && purchase.status !== 'paid') {
      return res.status(400).json({ 
        status: "UNPAID", 
        error: "Payment is still pending for this student." 
      });
    }

    res.json({ status: 'VALID', purchase });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server database error" });
  }
};

// Function to recover transaction reference based on matric number, manual ID, and department
const recoverReference = async (req, res) => {
  const { matricNo, manualId, department } = req.body;

  if (!matricNo || !manualId || !department) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const purchase = await prisma.purchase.findFirst({
    where: {
      matricNo,
      manualId: Number(manualId),
      department,
      status: 'paid'
    }
  });

  if (!purchase) {
    return res.status(404).json({ message: 'No paid purchase found' });
  }

  res.json({ reference: purchase.transactionRef });
};


//Get receipt details based on matric number and transaction reference

// 
const getReceipt = async (req, res) => {
  const { matricNo, reference } = req.body;

  if (!matricNo || !reference) {
    return res.status(400).json({ message: 'Matric number and reference required' });
  }

  try {
    const purchase = await prisma.purchase.findFirst({
      where: {
        matricNo,
        transactionRef: reference,
        status: 'paid'
      },
      include: { manual: true }
    });

    if (!purchase) {
      return res.status(404).json({ message: 'No valid receipt found' });
    }

    console.log("Sending to:", purchase.email);

    const qrUrl = `${process.env.BASE_URL}/api/purchases/verify/${purchase.qrToken}`;

    console.log("QR URL:", qrUrl);

    const qrCode = await QRCode.toDataURL(qrUrl);

    console.log("QR Code generated successfully");

    return res.json({
      receipt: {
        id: purchase.id,
        fullName: purchase.fullName,
        manual: purchase.manual.title,
        courseCode: purchase.manual.courseCode,
        department: purchase.department,
        level: purchase.level,
        amount: purchase.manual.price,
        session: "2025/2026",
        reference: purchase.transactionRef,
        date: purchase.createdAt,
        qrCode: qrCode
      }
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Shared helper for paid purchases
const processSuccessfulPayment = async (reference) => {
  const purchase = await prisma.purchase.findFirst({
    where: { transactionRef: reference },
    include: { manual: true }
  });

  if (!purchase) {
    throw new Error(`Purchase not found for reference: ${reference}`);
  }

  if (purchase.status === 'paid') {
    return purchase;
  }

  const qrToken = uuidv4();
  const updatedPurchase = await prisma.purchase.update({
    where: { id: purchase.id },
    data: {
      status: 'paid',
      qrToken,
    },
    include: { manual: true }
  });

  const qrUrl = `${process.env.BASE_URL}/api/purchases/verify/${qrToken}`;
  const qrBuffer = await QRCode.toBuffer(qrUrl);
  const pdfBuffer = await generateReceiptPDF(updatedPurchase, qrBuffer);

  await transporter.sendMail({
    to: updatedPurchase.email,
    subject: `LAUTECH Receipt: ${updatedPurchase.manual.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #003366;">Payment Successful</h2>
        <p>Hello <b>${updatedPurchase.fullName}</b>,</p>
        <p>Your payment for <b>${updatedPurchase.manual.title}</b> has been confirmed.</p>
        <p>Please find your <b>Official Digital Receipt</b> attached as a PDF to this email.</p>
        <p>Download it and present the QR code at the collection point to get your manual.</p>
        <hr />
        <p style="font-size: 11px; color: #888;">Transaction Ref: ${reference}</p>
      </div>
    `,
    attachments: [
      {
        filename: `LAUTECH_Receipt_${updatedPurchase.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  return updatedPurchase;
};

const verifyPayment = async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: 'Transaction reference is required' });
  }

  try {
    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (paystackRes.data.data.status !== 'success') {
      return res.status(400).json({ error: 'Payment has not been completed on Paystack' });
    }

    const updatedPurchase = await processSuccessfulPayment(reference);

    return res.status(200).json({
      message: 'Payment verified and receipt sent successfully',
      purchase: updatedPurchase
    });
  } catch (error) {
    console.error('verifyPayment error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
};

const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return res.status(400).send('Missing Paystack signature');
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      return res.status(401).send('Invalid signature');
    }

    const payload = Buffer.isBuffer(req.body)
      ? JSON.parse(rawBody.toString('utf8'))
      : req.body;

    if (!payload || !payload.event) {
      return res.status(400).send('Invalid webhook payload');
    }

    if (payload.event !== 'charge.success' && payload.event !== 'transaction.success') {
      return res.status(200).send('Ignored event');
    }

    const reference = payload.data?.reference;
    if (!reference) {
      return res.status(400).send('Missing reference');
    }

    await processSuccessfulPayment(reference);
    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return res.status(500).send('Webhook processing failed');
  }
};

// Function to create a new purchase

const initializePurchase = async (req, res) => {
    try {
        console.log("Incoming Request Data:", req.body);
        
        const { manualId, fullName, matricNo, department, level, email } = req.body;

        // 1. STRICTURE VALIDATION
        if (!manualId || !fullName || !matricNo || !department || !level || !email) {
            return res.status(400).json({ error: 'All fields are required. Please check your form.' });
        }

        const idAsNumber = parseInt(manualId, 10);
        const levelNumber = parseInt(level, 10);
        const allowedLevels = [100, 200, 300, 400, 500];

        if (isNaN(idAsNumber) || !allowedLevels.includes(levelNumber)) {
            return res.status(400).json({ error: 'Invalid Manual ID or Level format.' });
        }

        // 2. CHECK IF MANUAL EXISTS & IS ACTIVE
        const manual = await prisma.manual.findUnique({
            where: { id: idAsNumber },
        });

        if (!manual || !manual.isActive) {
            return res.status(404).json({ error: 'The requested manual is currently unavailable for purchase.' });
        }

        // 3. CHECK IF ALREADY PAID
        // We only block the user if they have a 'paid' status.
        const completedPurchase = await prisma.purchase.findFirst({
            where: {
                manualId: idAsNumber,
                matricNo: matricNo.trim(),
                status: 'paid' 
            }
        });

        if (completedPurchase) {
            return res.status(400).json({ error: 'Our records show you have already paid for this manual.' });
        }

        // 4. DATABASE TRANSACTION (DELETE OLD PENDING & CREATE NEW)
        // This ensures that if the user had a network error before, we clear it and start fresh.
        const reference = `MNL-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        const newPurchase = await prisma.$transaction(async (tx) => {
            // Remove any previous 'pending' attempts for this specific manual/student
            await tx.purchase.deleteMany({
                where: {
                    manualId: idAsNumber,
                    matricNo: matricNo.trim(),
                    status: 'pending'
                }
            });

            // Create the new official attempt
            return await tx.purchase.create({
                data: {
                    manualId: idAsNumber,
                    fullName: fullName.trim(),
                    matricNo: matricNo.trim(),
                    department: department.trim(),
                    level: levelNumber,
                    email: email.trim().toLowerCase(),
                    transactionRef: reference,
                    amount: manual.price,
                    status: 'pending'
                },
            });
        });

        // 4. Call Paystack Initialize (Direct Redirect Method)

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email.trim(),
        amount: manual.price * 100, 
        reference: reference, // Tell Paystack to use our REF
        callback_url: `${frontendUrl}/verify-payment`, 
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

        // 5. OPTIONAL: NON-BLOCKING MAILER
        // We do NOT 'await' this so that the student gets the Paystack window immediately.
        try {
            // Replace with your actual mail function if you have one
            // sendInitEmail(email, fullName, manual.title, reference);   
            console.log(`✅ Success: Initialized purchase for ${matricNo}`);
        } catch (mailErr) {
            console.error("Mailer Warning (Non-Fatal):", mailErr.message);
        }

        // 6. RETURN SUCCESS TO FRONTEND
        return res.status(201).json({ 
            message: 'Purchase initialized successfully',
            authorization_url: paystackRes.data.data.authorization_url, 
            purchase: newPurchase 
        });

    } catch (error) {
        console.error('CRITICAL ERROR in initializePurchase:');
        console.error(error.message);
        
        // Handle specific Prisma errors (like unique constraint failures)
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'A transaction with this reference already exists. Please try again.' });
        }

        return res.status(500).json({ 
            error: 'Server error during initialization. Please check your internet connection.', 
            details: error.message 
        });
    }
};


const getAllPurchases = async (req, res) => {
  try {
    // This talks to your PostgreSQL database via Prisma
    const purchases = await prisma.purchase.findMany({
      include: {
        manual: true, // This includes the name/price of the manual sold
        collectedBy: true,   // This includes the info of the student who bought it
      },
      orderBy: {
        createdAt: 'desc', // Shows the most recent sales first
      },
    });

    res.status(200).json(purchases);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ message: "Failed to fetch sales data" });
  }
};


const getStaffHistory = async (req, res) => {
  try {
    // We get 'req.user.id' from the authenticateToken middleware
    const history = await prisma.purchase.findMany({
      where: {
        status: 'paid', 
        collectedById: req.user.id,
        collected: true 
      },
      orderBy: {
        updatedAt: 'desc' 
      },
      take: 10,
      include: {
        manual: true 
      }
    });

    return res.status(200).json(history);
  } catch (error) {
    console.error("History Error:", error);
    return res.status(500).json({ error: "Failed to fetch collection history" });
  }
};


const generateReceiptPDF = (purchase, qrCodeBuffer) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A6', margin: 0 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const logoPath = path.join(__dirname, '../assets/lauuuu.png'); 
    const datePrinted = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // --- 1. WATERMARKS (Fixed Opacity for Readability) ---
    try {
      doc.save().opacity(0.03).image(logoPath, 49, 130, { width: 200 }).restore();
      doc.save().opacity(0.05).fillColor('#FF0000').fontSize(60).font('Helvetica-Bold')
         .rotate(-30, { origin: [149, 210] }).text('PAID', 100, 190).restore();
    } catch (e) {}

    // --- 2. SERIAL NUMBER (Top) ---
    doc.fillColor('#999999').fontSize(7).font('Helvetica-Bold')
       .text(`SERIAL NO: LAU-2026-${String(purchase.id).padStart(4, '0')}`, 0, 22, { align: 'center' });

    // --- 3. HEADER (Logo & Name) ---
    try { doc.image(logoPath, 129, 35, { width: 40 }); } catch (e) {}
    doc.fillColor('#003366').fontSize(9).font('Helvetica-Bold')
       .text('LADOKE AKINTOLA UNIVERSITY', 0, 88, { align: 'center' }) 
       .text('OF TECHNOLOGY', { align: 'center' });

    doc.fillColor('#666666').fontSize(7).font('Helvetica-Bold')
       .text(`2025/2026 ACADEMIC SESSION`, 0, 112, { align: 'center' });

    // --- 4. STUDENT DATA (Compressed) ---
    const startX = 35;
    const drawRow = (label, value, y) => {
      doc.fillColor('#999999').fontSize(6.5).font('Helvetica').text(label.toUpperCase(), startX, y);
      doc.fillColor('#000000').fontSize(8.5).font('Helvetica-Bold').text(value ? value.toUpperCase() : 'N/A', startX, y + 9);
    };

    drawRow('Student Name', purchase.fullName, 132);
    drawRow('Matric Number', purchase.matricNo, 155);
    drawRow('Manual Ordered', purchase.manual ? `${purchase.manual.courseCode}: ${purchase.manual.title}` : 'OFFICIAL MANUAL', 178);

    // --- 5. AMOUNT SECTION ---
    doc.moveTo(35, 205).lineTo(263, 205).strokeColor('#EEEEEE').lineWidth(0.5).stroke();
    doc.fillColor('#999999').fontSize(6.5).text('LEVEL', startX, 212);
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text(`${purchase.level}L`, startX, 222);

    doc.fillColor('#999999').fontSize(6.5).text('AMOUNT PAID', 180, 212, { align: 'right', width: 83 });
    doc.fillColor('#15803d').fontSize(10).font('Helvetica-Bold')
       .text(`N${Number(purchase.amount || 0).toLocaleString()}`, 180, 222, { align: 'right', width: 83 });

    // --- 6. THE BIG QR CODE (110px Wide - Maximum scan-ability) ---
    if (qrCodeBuffer) {
      const qrSize = 110;  
      const boxSize = 120; 
      const qrX = (298 - boxSize) / 2; 
      
      doc.rect(qrX, 245, boxSize, boxSize).strokeColor('#F0F7FF').lineWidth(4).stroke();
      doc.image(qrCodeBuffer, qrX + 5, 250, { width: qrSize, height: qrSize });
    }

    // --- 7. FOOTER (Bottom Safety Zone) ---
    const footerY = 388; 
    doc.fillColor('#777777').fontSize(7.5).font('Helvetica-Bold')
       .text(`REF: ${purchase.transactionRef || 'PENDING'}`, 0, footerY, { align: 'center' });

    doc.fillColor('#AAAAAA').fontSize(6).font('Helvetica')
       .text(`Generated on: ${datePrinted}`, 0, footerY + 10, { align: 'center' });

    doc.end();
  });
};

module.exports = { initializePurchase,
   verifyPayment,
    getReceipt, 
    recoverReference, 
    verifyQR, 
    markCollected,
    getAllPurchases,
    getStaffHistory,
    generateReceiptPDF,
    handlePaystackWebhook
};