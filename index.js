const express = require('express');
const app = express();
require('dotenv').config();
const index = require('./routes/routes')
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path')
const bodyParser = require('body-parser')
const session = require('express-session');
const passport = require('passport');

// Middleware to parse JSON bodies
app.use(express.json());
app.use(morgan('dev'));
// app.use(session({
//     secret: 'cat', // Replace with a strong secret key
//     resave: false,
//     saveUninitialized: true,
//     cookie: { secure: true } // Set to true if using HTTPS
// }));

app.use(passport.initialize());
app.use(passport.session());












// Basic route

app.use('/', index)



// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});


// MongoDB Connection 
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));