const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Connect to your account using the .env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'manuals', // The folder name that will appear in Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
    // Use the unsigned preset you created in the screenshot
    upload_preset: 'manual_uploads', 
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };