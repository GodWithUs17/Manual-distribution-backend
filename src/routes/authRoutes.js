const express = require('express');
const {login } = require('../controllers/authController');
const { forgotPassword, resetPassword } = require('../controllers/adminController');

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;