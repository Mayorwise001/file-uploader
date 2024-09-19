const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
      },
      parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
      // files: [{
      //   type: String // Store file names
      // }],
      files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Link folder to user
    });

    // Compound unique index on both user and name fields
folderSchema.index({ user: 1, name: 1 }, { unique: true });
const Folder = mongoose.model('Folder', folderSchema);

module.exports = Folder;
