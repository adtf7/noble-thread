const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userschema');
let env = require('dotenv').config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret:'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',
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let existingUser = await User.findOne({ googleId: profile.id });

      if (existingUser) {
        return done(null, existingUser);
      }
      
      let newUser = new User({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id
      });

      await newUser.save();
      done(null, newUser);
    } catch (error) {
      done(error, false);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
 
     User.findById(id).then(user=>{
      done(null,user)
     }).catch(err=>{
       done(err,null);
     })
});

module.exports = passport