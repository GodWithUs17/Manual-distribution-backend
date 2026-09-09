const express = require('express');
const { createManual, getManuals, toggleManualStatus,updateManual, deleteManual, restockManual } = require('../controllers/manualController');
const { authorize, authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/',  
    authenticate, 
    authorize(['super_admin', 'admin']),
     upload.single('image'), 
     createManual);

router.get('/', optionalAuthenticate, getManuals);

router.patch('/:id', 
    authenticate, 
    authorize(['super_admin', 'admin']), 
    upload.single('image'), 
    updateManual
);

router.patch('/:id/toggle',
     authenticate,
     authorize(['super_admin', 'admin']),
      toggleManualStatus);

router.patch('/:id/restock',
    authenticate,
    authorize(['super_admin', 'admin']),
    restockManual
);

router.delete('/:id', 
    authenticate, 
    authorize(['super_admin', 'admin']), 
    deleteManual
);      

module.exports = router;
