const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

// Middleware to parse request body
router.use(express.urlencoded({ extended: true }));

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}


router.get('/', (req, res) => {
    res.render('login', { errors: [], formData: {}, successMessage: null });
  });


  
  // Signup route with validation
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
        res.render('signup', {
            errors: [],
            formData: {},
            successMessage: 'User successfully created'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


router.get('/', (req, res) => {
    // res.render('login', { errors: [], formData: {}, messages: [{ msg: 'Successfully logged in!', type: 'success' }], });

    // Clear the success message and form data from the session
    const successMessage = req.session.successMessage || '';
    req.session.successMessage = ''; // Clear success message

    res.render('login', {
        errors: [],
        formData: {},
        successMessage: successMessage,
        
    });
});


// POST route for login form submission
router.post('/', [
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
            res.redirect('/dashboard');
        });
    })(req, res, next);
});


// Route for the dashboard
router.get('/dashboard', ensureAuthenticated, (req, res) => {
    // Dummy user data for demonstration
    const user = {
        username: 'JohnDoe',
        email: 'johndoe@example.com'
    };

    // Render the dashboard view
    res.render('dashboard', { user: req.user  });
});


// Signout route
router.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error(err);
                return res.redirect('/dashboard');
            }
            res.redirect('/login');
        });
    });
});


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