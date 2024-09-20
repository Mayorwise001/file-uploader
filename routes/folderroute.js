const express = require('express');
const router = express.Router();
const Folder = require('../models/folder');
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const File = require('../models/file');
const LocalStrategy = require('passport-local').Strategy;
const passport = require('passport');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
router.use(express.urlencoded({ extended: true }));





// Define Cloudinary storage for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'my_uploaded_images', // Folder in Cloudinary where images will be stored
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'pdf', 'doc', 'txt','docx', 'doc', 'mp4', 'mov', 'avi', 'mkv'],
    },
  });
  
  // Multer middleware to handle single file uploads
  const upload = multer({ storage });


  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/b/login');
}

router.get('/login', (req, res) => {
    res.render('login', { errors: [], formData: {}, messages: [{ msg: 'Successfully logged in!', type: 'success' }], });

    // Clear the success message and form data from the session
    const successMessage = req.session.successMessage || '';
    req.session.successMessage = ''; // Clear success message

    res.render('login', {
        errors: [],
        formData: {},
        successMessage: successMessage,
        
    });
});



router.get('/dashboard',ensureAuthenticated, async (req, res) => {
    try {

            // Fetch only parent folders (those without a parentFolderId)
    const folders = await Folder.find({ parentFolderId: null, user: req.user._id });
        res.render('dashboard2', { folders, username: req.user.username  });
      } catch (err) {
        res.status(500).send('Error fetching folders');
      }
});

// Route to delete a folder
router.post('/folder/:id/delete', ensureAuthenticated, async (req, res) => {
    try {
        const folderId = req.params.id;

        // Find and delete the folder by its ID
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        // Ensure the folder belongs to the logged-in user
        if (folder.user.toString() !== req.user._id.toString()) {
            return res.status(403).send('Unauthorized to delete this folder');
        }

        // Delete the folder
        await Folder.findByIdAndDelete(folderId);
        res.redirect('/b/dashboard');
    } catch (err) {
        console.error('Error deleting folder:', err);
        res.status(500).send('Error deleting folder');
    }
});


// Route to edit a folder name
router.post('/folder/:id/edit', ensureAuthenticated, async (req, res) => {
    try {
        const folderId = req.params.id;
        const newFolderName = req.body.newFolderName.trim();

        // Ensure the new folder name is not empty
        if (!newFolderName) {
            return res.status(400).send('Folder name cannot be empty');
        }

        // Find the folder by its ID and ensure it belongs to the logged-in user
        const folder = await Folder.findById(folderId);

        if (!folder) {
            return res.status(404).send('Folder not found');
        }

        if (folder.user.toString() !== req.user._id.toString()) {
            return res.status(403).send('Unauthorized to edit this folder');
        }

        // Update the folder name
        folder.name = newFolderName;
        await folder.save();

        // Redirect to the dashboard to stay on the same page
        res.redirect('/b/dashboard');
    } catch (err) {
        console.error('Error editing folder:', err);
        res.status(500).send('Error editing folder');
    }
});



// Route to handle folder creation
router.post('/create-folder', async (req, res) => {
    const folderName = req.body.folderName.trim();
    if (!folderName) {
      return res.redirect('/b/dashboard');
    }
  
    try {
      // Create new folder in MongoDB
      const newFolder = new Folder({ name: folderName,    
         user: req.user._id // Assign folder to the logged-in user 
         });
      await newFolder.save();
      res.redirect('/b/dashboard');
    } catch (err) {
      if (err.code === 11000) {
        // Handle unique constraint violation (duplicate folder name)
        res.send('You already have a folder with this name.');
      } else {
        res.status(500).send('Error creating folder');
      }
    }
  });


router.get('/folder/:folderId', ensureAuthenticated, async (req, res) => {
    try {
      // Find the folder and populate the files with their Cloudinary URLs
      const folder = await Folder.findById(req.params.folderId).populate('files');
      if (!folder || folder.user.toString() !== req.user._id.toString()) {
        return res.status(404).send('Folder not found');
      }
  
   // Log the folder and files for debugging
   console.log('Folder object:', folder);
   folder.files.forEach(file => {
     console.log('File object:', file);
   });

      // Fetch subfolders that have the current folder as their parent
      const subfolders = await Folder.find({ parentFolderId: folder._id });
  
      // Build breadcrumb trail by tracing back to parent folders
      let breadcrumb = [];
      let currentFolder = folder;
      while (currentFolder.parentFolderId) {
        breadcrumb.unshift(currentFolder); // Add the current folder to the beginning of the breadcrumb
        currentFolder = await Folder.findById(currentFolder.parentFolderId); // Move up to the parent folder
      }
      breadcrumb.unshift(currentFolder); // Finally, add the root parent folder to the breadcrumb
  
      folder.files.forEach(file => {
        console.log(`File URL: ${file.cloudinaryUrl}`);
      });
      // Render the folder and pass files with Cloudinary URLs
      res.render('folder', {
        folder,
        files: folder.files,
        subfolders,
        breadcrumb
      });
    } catch (err) {
      console.error("Error retrieving folder:", err); // Log the error
      res.status(500).send('Error fetching folder details');
    }
  });
  


  
    
router.post('/folder/:folderId/upload', upload.single('file'), async (req, res) => {
    try {
      const folder = await Folder.findById(req.params.folderId);
      if (!folder || folder.user.toString() !== req.user._id.toString()) {
        return res.status(404).send('Folder not found');
      }
  
      // Upload file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto'  // Allow all file types
      });
          // Log result to check if public_id is returned
    console.log("Cloudinary upload result:", result);
      // Create a new file entry with the Cloudinary public ID and URL
      const newFile = new File({
        filename: req.file.originalname,
        cloudinaryUrl: result.secure_url,    // Store the Cloudinary URL
        cloudinaryId: result.public_id,      // Store the Cloudinary public_id for deletion
        folder: folder._id,
        user: req.user._id                   // Assign file to the logged-in user
      });
  
      await newFile.save();
  
      // Add file reference to the folder's files array
      folder.files.push(newFile._id); // Store the file's ID in the folder
      await folder.save();
  
      res.redirect(`/b/folder/${req.params.folderId}`);
    } catch (err) {
        console.error('Error uploading file:', JSON.stringify(err, null, 2)); // Log the error as a string
      res.status(500).send('Error uploading file'  + err.message);
    }
  });
  
router.get('/folders/:folderName',ensureAuthenticated, async (req, res) => {
    const folderName = req.params.folderName;
    
    try {
        // Find the main folder
        const folder = await Folder.findOne({ name: folderName });
        if (!folder) {
          return res.status(404).send('Folder not found');
        }
    
        // Find subfolders using the parentFolderId
        const subfolders = await Folder.find({ parentFolderId: folder._id });
    
        // Build breadcrumb trail by tracing back to parent folders
let breadcrumb = [];
let currentFolder = folder;
while (currentFolder.parentFolderId) {
  breadcrumb.unshift(currentFolder); // Add the current folder to the beginning of the breadcrumb
  currentFolder = await Folder.findById(currentFolder.parentFolderId); // Move up to the parent folder
}
breadcrumb.unshift(currentFolder); // Finally, add the root parent folder to the breadcrumb

        // Render the folder page with both folder and subfolders
        res.render('folder', { folder, subfolders, breadcrumb });
      } catch (err) {
        res.status(500).send('Error retrieving folder');
      }
    });

router.post('/folders/:folderName/create-subfolder', ensureAuthenticated, async (req, res) => {
    const folderName = req.params.folderName;
    const subfolderName = req.body.subfolderName.trim();
  
    if (!subfolderName) {
      return res.redirect(`/b/folders/${folderName}`);
    }
  
    try {
        // Find the parent folder by name
        const parentFolder = await Folder.findOne({ name: folderName, user: req.user._id });
        if (!parentFolder) {
          return res.status(404).send('Parent folder not found');
        }
    
        // Create a new subfolder with the parentFolderId field referencing the parent folder
        const newSubfolder = new Folder({
          name: subfolderName,
          parentFolderId: parentFolder._id,
          user: req.user._id // Associate with the logged-in user
        });
        await newSubfolder.save();
        res.redirect(`/b/folder/${parentFolder._id}`);
      }catch (err) {
      if (err.code === 11000) {
        res.send('Subfolder with this name already exists');
      } else {
        res.status(500).send('Error creating subfolder');
      }
    }
  });


// Route to delete a subfolder
router.post('/folders/:subfolderId/delete', ensureAuthenticated, async (req, res) => {
    const subfolderId = req.params.subfolderId;
  
    try {
      // Find and delete the subfolder by its _id
      const deletedFolder = await Folder.findByIdAndDelete(subfolderId);
  
      if (!deletedFolder) {
        return res.status(404).send('Subfolder not found');
      }
  
      // After deletion, redirect to the parent folder's page
      res.redirect('back'); // Or you can redirect to the parent folder if needed
    } catch (err) {
      console.error("Error deleting subfolder:", err);
      res.status(500).send('Error deleting subfolder');
    }
  });

  router.post('/folders/:folderId/edit', ensureAuthenticated, async (req, res) => {
    const newFolderName = req.body.newFolderName.trim();
    const folderId = req.params.folderId;
  
    if (!newFolderName) {
      return res.redirect(`/b/folder/${folderId}`);
    }
  
    try {
      // Find the folder by ID and update the name
      const folder = await Folder.findById(folderId);
  
      if (!folder) {
        return res.status(404).send('Folder not found');
      }
  
      // Ensure the folder belongs to the logged-in user
      if (folder.user.toString() !== req.user._id.toString()) {
        return res.status(403).send('Unauthorized to edit this folder');
      }
  
      folder.name = newFolderName;
      await folder.save();
  
    //   res.redirect(`/b/folder/${folderId}`);
    res.redirect('back');
    } catch (err) {
      console.error('Error updating folder name:', err);
      res.status(500).send('Error editing folder');
    }
  });

  router.get('/uploads/:folderName/:fileName', ensureAuthenticated, (req, res) => {
    const folderName = req.params.folderName;
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'uploads', folderName, fileName);
  
    res.sendFile(filePath);
  });




router.get('/folder/:folderId/file/:fileId', ensureAuthenticated, async (req, res) => {
    try {
      const folderId = req.params.folderId;
      const fileId = req.params.fileId;
  
      // Find the folder and check if it contains the file
      const folder = await Folder.findById(folderId).populate('files');
      if (!folder || !folder.files.some(file => file._id.toString() === fileId)) {
        return res.status(404).send('File not found in this folder.');
      }
  
      // Fetch the file details from the database
      const file = await File.findById(fileId);
      if (!file) {
        return res.status(404).send('File not found.');
      }
  
      // Render a template to display file details (you can add more details as needed)
      res.render('image-details', { file, folder });
    } catch (err) {
      console.error('Error retrieving file details:', err);
      res.status(500).send('Error retrieving file details');
    }
  });


  
// Signout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error(err);
                return res.redirect('/dashboard');
            }
            res.redirect('/b/login');
        });
    });
});
router.get('/signup', (req, res) => {
    res.render('signup', { errors: [], formData: {}, successMessage: null });
  });

  router.post('/signup', [
        check('firstName').notEmpty().withMessage('First name is required'),
        check('lastName').notEmpty().withMessage('Last name is required'),
        check('email').isEmail().withMessage('Please enter a valid email'),
        check('password')
          .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
          .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
          .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
          .matches(/[0-9]/).withMessage('Password must contain a number')
          .matches(/[@$!%*?&#]/).withMessage('Password must contain a special character'),
        check('confirmPassword').custom((value, { req }) => {
          if (value !== req.body.password) {
            throw new Error('Passwords do not match');
          }
          return true;
        })
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('signup', {
                errors: errors.array(),
                formData: req.body,
                successMessage: null
            });
        }
    
        const { firstName, lastName, email, password } = req.body;
        const username = `${firstName}${lastName}`.toLowerCase();
    
        try {
            // Check if the username already exists
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.render('signup', {
                    errors: [{ msg: 'Username is already taken' }],
                    formData: req.body,
                    successMessage: null
                    
                });
            }
    
            // Check if the email already exists
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.render('signup', {
                    errors: [{ msg: 'Email is already registered' }],
                    formData: req.body,
                    successMessage: null
                    
                });
            }
    
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
    
            // Create a new user
            const user = new User({
                username,
                email,
                password: hashedPassword,
                firstName,
                lastName
            });
    
            await user.save();
            res.redirect('/b/login');
            // Set flash message for successful signup
        // req.flash('successMessage', 'User successfully created');
        // res.redirect('/b/login');  // Redirect to the login page
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });

   

// POST route for login form submission
router.post('/login', [
    check('username').notEmpty().withMessage('Username is required'),
    check('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', {
            errors: errors.array(),
            formData: {}, // Clear form data on error
            successMessage: ''
        });
    }
    router.get('/folder/:folderId/file/:fileId/delete', ensureAuthenticated, async (req, res) => {
        try {
          const folderId = req.params.folderId;
          const fileId = req.params.fileId;
      
          // Find the folder and ensure it contains the file
          const folder = await Folder.findById(folderId).populate('files');
          if (!folder || !folder.files.some(file => file._id.toString() === fileId)) {
            return res.status(404).send('File not found in this folder.');
          }
      
          // Fetch the file details from the database
          const file = await File.findById(fileId);
          
          if (!file) {
            return res.status(404).send('File not found.');
          }
          console.log(file.cloudinaryId);

          if (!file.cloudinaryId) {
            return res.status(500).send('cloudinaryId not found for the file.');
          }
          // Delete the file from Cloudinary using cloudinaryId
          await cloudinary.uploader.destroy(file.cloudinaryId); // Correct path to delete file
      
          // Delete the file from MongoDB
          await File.findByIdAndDelete(fileId);
      
          // Remove the file from the folder's file array
          folder.files.pull(fileId);
          await folder.save();
      
          // Redirect back to the folder or dashboard
          res.redirect(`/b/folder/${folderId}`);
        } catch (err) {
          console.error('Error deleting file:', err);
          res.status(500).send('Error deleting file');
        }
      });
    


// Passport Route
passport.authenticate('local', (err, user, info) => {
    if (err) {
        return next(err);
    }
    if (!user) {
        return res.render('login', {
            errors: [{ msg: info.message }],
            formData: {}, // Clear form data on error
            successMessage: ''
        });
    }

    req.logIn(user, (err) => {
        if (err) {
            return next(err);
        }

        // Successful login
        req.session.successMessage = 'Successfully logged in!';
        res.redirect('/b/dashboard');
    });
})(req, res, next);
})

passport.use(
    new LocalStrategy(async (username, password, done) => {
        try {
            const user = await User.findOne({ username });
            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});


module.exports = router;