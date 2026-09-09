const prisma = require('../utils/prisma');
const crypto = require('crypto');
const QRCode = require('qrcode');
const axios = require('axios');
const {sendManualEmail} = require('../utils/mailer')
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
          { transactionRef: reference }, // Check the payment reference
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
    if (purchase.status !== 'paid' && purchase.status !== 'success') {
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

    console.log("Sending to:" , purchase.email);

    const qrUrl = `${process.env.BASE_URL}/api/purchases/verify/${purchase.qrToken}`;

    console.log("QR URL:", qrUrl);

    const qrCode = await QRCode.toDataURL(qrUrl);

    console.log("QR Code generated successfully");

    const amountToShow = Number(purchase.amount || (purchase.manual && purchase.manual.price) || 0);

    return res.json({
      receipt: {
        id: purchase.id,
        fullName: purchase.fullName,
        manual: purchase.manual ? purchase.manual.title : 'OFFICIAL MANUAL',
        courseCode: purchase.manual ? purchase.manual.courseCode : null,
        department: purchase.department,
        level: purchase.level,
        amount: amountToShow,
        session: process.env.ACADEMIC_SESSION || '2025/2026',
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



const receiptQueue = [];
let isReceiptQueueProcessing = false;

const processReceiptQueue = async () => {
  if (isReceiptQueueProcessing) {
    return;
  }

  isReceiptQueueProcessing = true;

  try {
    while (receiptQueue.length > 0) {
      const job = receiptQueue.shift();

      try {
        const { purchase, reference } = job;
        const qrUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/purchases/verify/${purchase.qrToken}`;
        const qrBuffer = await QRCode.toBuffer(qrUrl);
        const pdfBuffer = await generateReceiptPDF(purchase, qrBuffer);

        await sendManualEmail({
          to: purchase.email,
          subject: `LAUTECH Receipt: ${purchase.manual.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; border: 1px solid #eee; padding: 20px;">
              <h2 style="color: #003366;">Payment Successful</h2>
              <p>Hello <b>${purchase.fullName}</b>,</p>
              <p>Your payment for <b>${purchase.manual.title}</b> has been confirmed.</p>
              <p>Please find your <b>Official Digital Receipt</b> attached as a PDF to this email.</p>
              <p>Download it and present the QR code at the collection point to get your manual.</p>
              <hr />
              <p style="font-size: 11px; color: #888;">Transaction Ref: ${reference}</p>
            </div>
          `,
          pdfBuffer: pdfBuffer,
          filename: `LAUTECH_Receipt_${purchase.id}.pdf`
        });
      } catch (error) {
        console.error('Receipt processing background error:', error.message);
      }
    }
  } finally {
    isReceiptQueueProcessing = false;

    if (receiptQueue.length > 0) {
      setImmediate(() => {
        processReceiptQueue().catch((error) => {
          console.error('Receipt queue restart failed:', error.message);
        });
      });
    }
  }
};

const queueReceiptProcessing = (purchase, reference) => {
  receiptQueue.push({ purchase, reference });

  if (!isReceiptQueueProcessing) {
    setImmediate(() => {
      processReceiptQueue().catch((error) => {
        console.error('Receipt queue failed to start:', error.message);
      });
    });
  }
};

const webhookEventCache = new Map();
const EVENT_CACHE_TTL_MS = 60 * 60 * 1000;

const isDuplicateWebhookEvent = (eventKey) => {
  if (!eventKey) {
    return false;
  }

  const now = Date.now();
  const cached = webhookEventCache.get(eventKey);

  if (cached && cached > now) {
    return true;
  }

  webhookEventCache.set(eventKey, now + EVENT_CACHE_TTL_MS);
  return false;
};

// Shared helper for paid purchases
const processSuccessfulPayment = async (reference) => {
  let updatedPurchase = null;
  let wasAlreadyPaid = false;

  await prisma.$transaction(async (tx) => {
    const lockedPurchaseRows = await tx.$queryRaw`
      SELECT p."id" AS "purchaseId"
      FROM "Purchase" p
      WHERE p."transactionRef" = ${reference}
      FOR UPDATE
    `;

    if (!Array.isArray(lockedPurchaseRows) || lockedPurchaseRows.length === 0) {
      throw new Error(`Purchase not found for reference: ${reference}`);
    }

    const purchaseId = Number(lockedPurchaseRows[0].purchaseId);
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: { manual: true }
    });

    if (!purchase) {
      throw new Error(`Purchase not found for reference: ${reference}`);
    }

    if (purchase.status === 'paid') {
      wasAlreadyPaid = true;
      updatedPurchase = purchase;
      return;
    }

    const updatedManual = await tx.manual.update({
      where: { id: purchase.manualId, stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });

    if (!updatedManual) {
      throw new Error(`Manual is sold out for reference: ${reference}`);
    }

    updatedPurchase = await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        status: 'paid',
        qrToken: crypto.randomUUID(),
      },
      include: { manual: true }
    });
  });

  if (wasAlreadyPaid) {
    return updatedPurchase;
  }

  if (!updatedPurchase) {
    return null;
  }

  queueReceiptProcessing(updatedPurchase, reference);
  return updatedPurchase;
};

const verifyPayment = async (req, res) => {
  const { reference, tx_ref, transaction_id } = req.body;
  const verificationKey = transaction_id || reference || tx_ref;

  if (!verificationKey) {
    return res.status(400).json({ error: 'Transaction reference is required' });
  }

  try {
    const directRef = tx_ref || reference;

    const existingPurchase = directRef
      ? await prisma.purchase.findFirst({
          where: { transactionRef: directRef },
          include: { manual: true }
        })
      : null;

    if (existingPurchase?.status === 'paid') {
      return res.status(200).json({
        message: 'Payment already confirmed',
        purchase: existingPurchase,
        alreadyPaid: true
      });
    }

    const flutterwaveRes = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(verificationKey)}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      }
    );

    // Debug log to inspect what Flutterwave actually returns on your server
    console.log("Flutterwave Verify Response:", JSON.stringify(flutterwaveRes.data));

    const verifiedTxRef =
      flutterwaveRes.data?.data?.tx_ref ||
      flutterwaveRes.data?.data?.txRef ||
      directRef ||
      reference ||
      tx_ref;

    const isSuccessful =
      flutterwaveRes.data?.status === 'success' &&
      ['successful', 'success', 'completed'].includes(flutterwaveRes.data?.data?.status);

    if (!isSuccessful) {
      return res.status(400).json({
        error: 'Payment has not been completed on Flutterwave',
        details: process.env.NODE_ENV !== 'production' ? flutterwaveRes.data : undefined,
      });
    }

    const updatedPurchase = await processSuccessfulPayment(verifiedTxRef);

    if (!updatedPurchase) {
      return res.status(404).json({
        error: 'Purchase record could not be found for verification.',
        reference: verifiedTxRef
      });
    }

    return res.status(200).json({
      message: 'Payment verified and receipt sent successfully',
      purchase: updatedPurchase,
      alreadyPaid: false
    });
  } catch (error) {
    const flutterwaveDetails = error.response?.data;
    console.error('verifyPayment error:', flutterwaveDetails || error.message);

    return res.status(500).json({
      error: 'Internal server error during verification',
      details: process.env.NODE_ENV !== 'production' ? flutterwaveDetails || error.message : undefined,
    });
  }
};

const handleFlutterwaveWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-flw-signature'];
    if (!signature) return res.status(400).send('Missing Flutterwave signature');

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const hash = crypto
      .createHmac('sha256', process.env.FLW_WEBHOOK_SECRET || process.env.FLW_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) return res.status(401).send('Invalid signature');

    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;
    const txRef = payload.data?.tx_ref || payload.data?.txRef;

    if (event === 'charge.completed' || payload.data?.status === 'successful') {
      if (!txRef) {
        return res.status(200).send('Event ignored: missing tx_ref');
      }

      const eventKey = `flutterwave:${txRef}`;
      if (isDuplicateWebhookEvent(eventKey)) {
        return res.status(200).send('Duplicate webhook ignored');
      }

      res.status(200).send('Webhook received');

      processSuccessfulPayment(txRef).catch(err => {
        console.error('Background Processing Error:', err.message);
      });

      return;
    }

    return res.status(200).send('Event ignored');
  } catch (error) {
    console.error('Flutterwave webhook error:', error);
    if (!res.headersSent) {
      return res.status(500).send('Webhook processing failed');
    }
  }
};

const handlePaystackWebhook = async (req, res) => {
  return handleFlutterwaveWebhook(req, res);
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

        if (manual.stock <= 0) {
            return res.status(400).json({ error: 'This manual is sold out and cannot be purchased right now.' });
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
        const shortID = crypto.randomBytes(3).toString('hex').toUpperCase();
        const reference = `T-${shortID}`;

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

        // 4. Initialize the Flutterwave checkout session

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const flutterwaveRes = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: reference,
        amount: String(manual.price),
        currency: "NGN",
        redirect_url: `${frontendUrl}/verify-payment`,
        payment_options: "card,banktransfer,ussd",
        customer: {
          email: email.trim(),
          name: fullName.trim(),
        },
        customizations: {
          title: manual.title,
          description: `Payment for ${manual.title}`,
          logo: process.env.FRONTEND_LOGO_URL || undefined,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

        // 5. OPTIONAL: NON-BLOCKING MAILER
        // We do NOT 'await' this so the student can continue to the Flutterwave checkout immediately.
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
            authorization_url: flutterwaveRes.data?.data?.link || flutterwaveRes.data?.data?.checkout_url,
            payment_url: flutterwaveRes.data?.data?.link || flutterwaveRes.data?.data?.checkout_url,
            reference: reference,
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


const getReceiptByDetails = async (req, res) => {
  // We get matricNo and courseCode (e.g., "ANB 301") from the student
  const { matricNo, courseCode } = req.query; 

  console.log("--- New Download Request ---");
console.log("Input Matric:", matricNo);
console.log("Input CourseCode:", courseCode);

  try {
    const purchase = await prisma.purchase.findFirst({
      where: {
        matricNo: matricNo.trim(),
        status: 'paid',
        manual: {
          courseCode: {
        equals: courseCode.trim(),
        mode: 'insensitive' // 👈 This makes "ans301" match "ANS 301"
      }
        }
      },
      include: { manual: true }
    });

    if (!purchase) {
      return res.status(404).json({ 
        error: 'No paid record found. Please check your Matric No and Course Code.' 
      });
    }

    // Generate QR and PDF (Same as before)
    const qrUrl = `${process.env.BASE_URL}/api/purchases/verify/${purchase.qrToken}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl);
    const pdfBuffer = await generateReceiptPDF(purchase, qrBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${courseCode}_Receipt.pdf`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  initializePurchase,
  verifyPayment,
  getReceipt,
  recoverReference,
  verifyQR,
  markCollected,
  getAllPurchases,
  getStaffHistory,
  generateReceiptPDF,
  handlePaystackWebhook,
  handleFlutterwaveWebhook,
  getReceiptByDetails
};