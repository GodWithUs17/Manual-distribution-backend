const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.post(
  '/paystack-webhook',
  express.raw({ type: 'application/json' }),
  purchaseController.handlePaystackWebhook
);

const {
  initializePurchase,
  verifyPayment,
  getReceipt,
  recoverReference,
  verifyQR,
  markCollected,
  getAllPurchases,
  getStaffHistory
} = purchaseController;

const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public (students)
router.post('/initialize', initializePurchase);
router.post('/verify', verifyPayment);
router.post('/receipt', getReceipt);
router.post('/recover-reference', recoverReference);

// Staff-only
router.get(
  '/verify/:reference',
  verifyQR
);

// Admin-only: Get all purchases for the dashboard
router.get(
  '/all', 
  authenticate, 
  authorize(['super_admin', 'admin']), 
  getAllPurchases // <--- This refers to the function in your controller
);

router.post(
  '/collect',
  authenticate,
  authorize(['staff', 'admin', 'super_admin']),
  markCollected
);

router.get("/staff-history",
   authenticate,
    authorize(['staff']),
   getStaffHistory);

module.exports = router;