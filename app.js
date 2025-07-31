const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const db = require('./config/db');
const passport = require('./config/passport');
const session = require('express-session');
const userRouter = require('./routes/userRouter');
const authRoutes = require('./routes/auth');   
let adminRouter=require('./routes/adminRouter') 
const errorHandler = require('./middlewares/errorHandler');
const {DeleteExpiredCoupon,changeProductOffer,changeCategoryOffer} = require('./cron/deleteExpiredCoupons');
const { userauth, adminauth } = require("./middlewares/auth");

dotenv.config();

db().catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false, 
    cookie: {
        secure: false, 
        maxAge: 72 * 60 * 60 * 1000, 
        httpOnly: true
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);
app.use('/auth', authRoutes);
app.use('/admin',adminRouter)
app.use(errorHandler);
app.use((req, res) => {
  res.status(404).redirect("/pagenotfound");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

DeleteExpiredCoupon();
changeProductOffer()
changeCategoryOffer()
module.exports = app;
