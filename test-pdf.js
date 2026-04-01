const fs = require('fs');
const path = require('path');
// Make sure this path points to your PDF generator file!
const {generateReceiptPDF} = require('./src/controllers/purchaseController');

const fakeStudent = {
    id: 1,
    fullName: "AJAYI FAVOUR",
    matricNo: "2023010354",
    level: 300,
    amount: 2500, 
    transactionRef: "PAY-LAU-998877",
    manual: {
        courseCode: "APH 305",
        title: "INTRODUCTION TO ANIMAL NUTRITION"
    }
};

async function createTestFile() {
    try {
        console.log("Generating your preview...");

        // 1. We grab your logo and "pretend" it's a QR code buffer for this test
        const logoPath = path.join(__dirname, './src/assets/lauuuu.png');
        const fakeQrBuffer = fs.readFileSync(logoPath); 

        // 2. Now we pass that fake buffer into the function
        const pdfBuffer = await generateReceiptPDF(fakeStudent, fakeQrBuffer);
        
        fs.writeFileSync('TEST_RECEIPT_PREVIEW.pdf', pdfBuffer);
        console.log("✅ DONE! Open 'TEST_RECEIPT_PREVIEW.pdf' to see the QR box and S/N fix.");
    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

createTestFile();