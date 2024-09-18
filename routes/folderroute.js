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

router.use(express.urlencoded({ extended: true }));

// Multer configuration for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const folderPath = path.join(__dirname, 'uploads', req.params.folderId);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      cb(null, folderPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  
  const upload = multer({ storage: storage });

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

// Route to display files in a specific folder
router.get('/folder/:folderId', ensureAuthenticated, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    if (!folder) {
      return res.status(404).send('Folder not found');
    }
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

    res.render('folder', { folder, subfolders, breadcrumb });
  } catch (err) {
    console.error("Error retrieving folder:", err); // Log the error
    res.status(500).send('Error fetching folder details');
  }
});

// Route to handle file uploads into a folder
router.post('/folder/:folderId/upload', upload.single('file'), async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.folderId);
    if (!folder || folder.user.toString() !== req.user._id.toString()) {
      return res.status(404).send('Folder not found');
    }

        // Add the file to the folder and associate it with the logged-in user
        const newFile = new File({
            filename: req.file.filename,
            folder: folder._id,
            user: req.user._id // Assign file to the logged-in user
        });
        await newFile.save();

    // Add file name to the folder's files array
    folder.files.push(req.file.filename);
    await folder.save();

    res.redirect(`/b/folder/${req.params.folderId}`);
  } catch (err) {
    
    res.status(500).send('Error uploading file');
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

  router.get('/folder/:folderId/image/:fileName',ensureAuthenticated, async (req, res) => {
    try {
      const folderId = req.params.folderId;
      const fileName = req.params.fileName;
  
      // Find the folder and check if it contains the file
      const folder = await Folder.findById(folderId);
      if (!folder || !folder.files.includes(fileName)) {
        return res.status(404).send('File not found in this folder.');
      }
  
      // Provide file details (add more details as needed)
      const filePath = path.join(__dirname, 'uploads', folder.name, fileName);
      res.render('image-details', { folder, fileName, filePath });
    } catch (err) {
      res.status(500).send('Error retrieving file details');
    }
  });

  router.post('/folder/:folderId/image/:fileName/delete', ensureAuthenticated, async (req, res) => {
    try {
        const folderId = req.params.folderId;
        const fileName = req.params.fileName;

        // Find the folder and check if it contains the file
        const folder = await Folder.findById(folderId);
        if (!folder || !folder.files.includes(fileName)) {
            return res.status(404).send('File not found in this folder.');
        }

        // Construct the file path using the folder name and file name
        const filePath = path.join(__dirname, 'uploads',folderId, fileName);

         // Log the file path for debugging
         console.log('Attempting to delete file at:', filePath);
        // Check if the file exists before attempting to delete
        if (fs.existsSync(filePath)) {
            // Delete the file from the filesystem
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting file:', err);
                    return res.status(500).send('Error deleting file');
                }

                // Remove the file from the folder's file array after successful deletion
                folder.files = folder.files.filter(file => file !== fileName);
                folder.save();

                res.redirect(`/b/folder/${folderId}`);
            });
        } else {
            console.error('File does not exist:', filePath);
            return res.status(404).send('File not found on the server.');
        }
    } catch (err) {
        console.error('Error during deletion:', err);
        res.status(500).send('Error deleting file');
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