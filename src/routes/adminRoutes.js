const express = require('express');
const router = express.Router();
const { downloadManualPurchases } = require('../controllers/adminController');
const { createStaff } = require('../controllers/adminController');
const { disableStaff } = require('../controllers/adminController');
const { enableStaff } = require('../controllers/adminController');
const { getAllStaff } = require('../controllers/adminController');
const { deleteUser } = require('../controllers/adminController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get(
  '/download-purchases',
  authenticate, 
  authorize(['admin', 'super_admin']), 
  downloadManualPurchases
);

router.post(
  "/create-staff",
  authenticate,
  authorize(["super_admin"]),
  createStaff
);

router.get(
  "/staff",
  authenticate,
  authorize(["admin", "super_admin"]),
  getAllStaff
);

router.patch(
  "/staff/:userId/disable",
  authenticate,
  authorize(["admin", "super_admin"]),
  disableStaff
);

router.patch(
  "/staff/:userId/enable",
  authenticate,
  authorize(["admin", "super_admin"]),
  enableStaff
);

router.delete('/staff/:userId',
   authenticate,
   authorize(['super_admin']), 
   deleteUser);
   
module.exports = router;


