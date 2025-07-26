const express = require('express');
const router = express.Router();
const { userauth, adminauth } = require('../middlewares/auth');
const userController = require('../controllers/user/usercontroller');
const passport = require('passport');
const userProfileController = require('../controllers/user/userprofileController');
const cartController = require('../controllers/user/cartController');
const wishlistController = require('../controllers/user/wishlistController');

router.get('/pagenotfound', userController.pagenotfound);
router.get('/', userController.loadHomePage);
router.get('/signup', userController.loadSignup);
router.get('/shop', userController.loadShopping);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendotp);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user.id;
    res.redirect('/');
});
router.get('/login', userController.loadlogin);
router.post('/login', userController.login);
router.get('/forgotpasswordemail', userController.forgotemailpassword);
router.post('/verify-otp4pass', userController.verifyOtppass);
router.post('/resetpassword', userController.updatepassword);
router.use(userauth)
router.get('/logout', userController.logout);

router.get('/product',  userController.loadproduct);
router.get('/product/:id', userController.loadProductDetails);

router.post('/submit-review',userController.review);
router.post('/delete-review',userController.deleteReview)

router.get('/profile',  userProfileController.userProfile);
router.post('/update-profile',  userProfileController.edituser);
router.get('/change-password',  userProfileController.changepassword);
router.post('/change-password',userProfileController.changenewpassword);
router.get('/address',  userProfileController.addressmanagement);
router.post('/add-address',  userProfileController.addaddress);
router.put('/editaddresses/:id',  userProfileController.editAddress);
router.get('/editaddresses/:id',  userProfileController.seteditAddress);
router.post('/addressesdelete/:id',  userProfileController.deleteAddress);
router.get('/download-invoice/:orderId',  userProfileController.downloadInvoice);

router.post('/add-to-cart',  cartController.addToCart);
router.get('/cart',  cartController.loadcart);
router.post('/resend-otpforgot', userController.resendotpassword);
router.post('/update-cart-item',  cartController.updateCartItem);
router.post('/remove-cart-item',  cartController.removeCartItem);
router.get('/checkout',  cartController.loadcheckout);
router.get('/order-success',  cartController.orderSuccess);
router.get('/order-failed',  cartController.orderFailed);
router.post('/place-order',  cartController.placeOrder);
router.post('/handle-razorpay-payment-success',  cartController.handleRazorpayPaymentSuccess);
router.post('/order-failed/:orderId',  cartController.markOrderFailed);
router.get('/get-payment-methods',  cartController.getPaymentMethods);
router.post('/create-razorpay-order',  cartController.createRazorpayOrder);
router.post('/get-updated-price-details',  cartController.getUpdatedPriceDetails);

router.get('/orders/:id',  userProfileController.orderDetails);
router.get('/order-history',  userProfileController.orderHistory);
router.post('/return-order',  userProfileController.returnOrder);
router.post('/cancel-order',  userProfileController.cancelorder);
router.get('/wallet',  userProfileController.loadwallet);
router.post('/create-razorpay-orderonwallet',  userProfileController.createRazorpayOrd);
router.post('/verify-payment',  userProfileController.verifypayment);
router.post('/addwishlist',  wishlistController.addwishlist);
router.get('/wishlist',  wishlistController.loadwishlist);
router.post('/remove-wishlist',  wishlistController.removewishlist);
router.post('/addtocartwishlist',  wishlistController.addtocartwishlist);
router.post('/save-failed-order',  cartController.saveFailedOrder);
router.post('/retry-razorpay-order',  userProfileController.retryRazorpayOrder);
router.post('/reverify-payment',  userProfileController.reverifyPayment);
module.exports = router;