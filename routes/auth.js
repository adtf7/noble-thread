const express = require('express');
const passport = require('../config/passport');

const router = express.Router();



router.get('/profile', (req, res) => {
  console.log('Session Data:', req.session);
  console.log('User Data:', req.user); 
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.user });
});


router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

module.exports = router;
