const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../../cloudinaryConfig'); // Ensure this path to your config is correct

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'manuals', // This creates a folder named 'manuals' in your Cloudinary dashboard
    allowed_formats: ['jpg', 'png', 'jpeg'],
    // Optional: add transformation like resizing if you want
    transformation: [{ width: 500, height: 700, crop: 'limit' }] 
  },
});

const upload = multer({ storage: storage });

module.exports = upload;