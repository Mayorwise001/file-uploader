const express = require('express');
const router = express.Router();


router.get('/', (req, res) => {
res.redirect('/b/login')
})
router.get('/signup', (req, res) => {
res.redirect('/b/signup')
})



module.exports = router;