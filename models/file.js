const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    filename: {
        type: String,
        required: true,
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
    // user: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //     required: true,
    //},

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link file to user
    createdAt: {
        type: Date,
        default: Date.now  // Automatically sets the createdAt field
    }
});

const File = mongoose.model('File', fileSchema);
module.exports = File;
