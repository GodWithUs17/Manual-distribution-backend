const express = require('express');
const { createManual, getManuals, toggleManualStatus,updateManual, deleteManual } = require('../controllers/manualController');
const { authorize, authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

// Only admins can create manuals
router.post('/',  
    authenticate, 
    authorize('super_admin', 'admin'),
     upload.single('image'), 
     createManual);

// Anyone (including students later) can view active manuals
router.get('/', optionalAuthenticate, getManuals);

// 3. Update Manual (New: Handles text updates AND new image uploads)
router.patch('/:id', 
    authenticate, 
    authorize('super_admin', 'admin'), 
    upload.single('image'), 
    updateManual
);

// Admin can enable/disable manual
router.patch('/:id/toggle',
     authenticate,
     authorize('super_admin', 'admin'),
      toggleManualStatus);

// 5. Delete Manual (New: Permanently removes record and image)
router.delete('/:id', 
    authenticate, 
    authorize('super_admin', 'admin'), 
    deleteManual
);      

module.exports = router;
