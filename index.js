const express = require('express');
const app = express();
require('dotenv').config();
const indexRouter = require('./routes/index')
const folderRouter = require('./routes/folderroute')
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path')
const bodyParser = require('body-parser')
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');

// Middleware to parse JSON bodies
app.use(express.json());
app.use(morgan('dev'));
app.use(session({
    secret: 'cat', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(flash());

// Make flash messages available in all views
app.use((req, res, next) => {
  res.locals.successMessage = req.flash('successMessage');
  res.locals.errors = req.flash('errors');
  next();
});

app.use(passport.initialize());
app.use(passport.session());


// Basic route

app.use('/', indexRouter)
app.use('/b', folderRouter)
// app.get('/', (req,res)=>{
//   res.send("Hello")
// })


// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/icons', express.static('icons'));

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


const methodOverride = require('method-override');

// Middleware to override methods for forms
app.use(methodOverride('_method'));