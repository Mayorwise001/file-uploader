const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    filename: {
        type: String,
        required: true,
    },

    cloudinaryUrl: {
      type: String,
      required: true // Ensure this is required, so every file must have a Cloudinary URL
    },
    cloudinaryId: {
        type: String,  // Add this field to store the Cloudinary public_id for file deletion
        required: true // Ensure this is required, so every file must have a Cloudinary ID for deletion
      },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null // If null, the file is in the root directory
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link file to user
    createdAt: {
        type: Date,
        default: Date.now  // Automatically sets the createdAt field
    }
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
