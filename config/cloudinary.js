const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // from Cloudinary Dashboard
  api_key: process.env.CLOUDINARY_API_KEY,      // from Cloudinary Dashboard
  api_secret: process.env.CLOUDINARY_API_SECRET, // from Cloudinary Dashboard
});

module.exports = cloudinary;
