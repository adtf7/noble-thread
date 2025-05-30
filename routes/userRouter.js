let express = require('express');
let router = express.Router();
let { userauth, adminauth } = require('../middlewares/auth');
let userController = require('../controllers/user/usercontroller');
const passport = require('passport');
let userProfileController=require('../controllers/user/userprofileController')
let cartController = require('../controllers/user/cartController');
let wishlistController = require("../controllers/user/wishlistController");

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
router.get('/contact',userauth, userController.loadContactPage);
router.get('/logout',userauth, userController.logout);

router.get('/product',userauth, userController.loadproduct);
router.get('/product/:id', userController.loadProductDetails); // Load single product details


router.get('/forgotpasswordemail',userController.forgotemailpassword)
router.post('/verify-otp4pass', userController.verifyOtppass); // Handle the OTP verification
router.post('/resetpassword',userController.updatepassword)

router.get('/profile',userauth,userProfileController.userProfile )
router.post('/update-profile',userauth,userProfileController.edituser)
router.get('/change-password',userauth,userProfileController.changepassword)
router.post('/change-password',userauth,userProfileController.changenewpassword)
router.get('/address',userauth,userProfileController.addressmanagement)
router.post('/add-address',userauth,userProfileController.addaddress)
router.put('/editaddresses/:id', userauth, userProfileController.editAddress);
router.get('/editaddresses/:id', userauth, userProfileController.seteditAddress);
router.post('/addressesdelete/:id', userauth, userProfileController.deleteAddress);

router.post('/add-to-cart', userauth, cartController.addToCart);
router.get('/cart',userauth,cartController.loadcart)
router.post('/resend-otpforgot',userController.resendotpassword)
router.post('/update-cart-item',userauth, cartController.updateCartItem);
router.post('/remove-cart-item',userauth, cartController.removeCartItem);
router.get('/checkout',userauth,cartController.loadcheckout)
router.get ('/order-success',userauth,cartController.orderSuccess)
router.post('/place-order',userauth,cartController.placeorder)
router.post(
  "/handle-razorpay-payment-success",
  userauth,
  cartController.handleRazorpayPaymentSuccess
);
router.post('/create-razorpay-order',userauth,cartController.createRazorpayOrder);
router.post('/handle-payment-success',userauth,cartController.handlesuccess)
router.get('/orders/:id',userauth,userProfileController.orderDetails)
router.get('/order-history',userauth,userProfileController.orderHistory)
router.post("/return-order", userauth, userProfileController.returnOrder);
router.post('/cancel-order', userauth, userProfileController.cancelorder);
router.get("/wallet", userauth, userProfileController.loadwallet);
router.post("/create-razorpay-orderonwallet",userauth,userProfileController.createRazorpayOrd);
router.post("/verify-payment", userauth, userProfileController.verifypayment);
router.post("/get-updated-price-details", userauth, cartController.getUpdatedPriceDetails);

router.post("/addwishlist", userauth, wishlistController.addwishlist);
router.get('/wishlist',userauth,wishlistController.loadwishlist)
router.post(  "/remove-wishlist", userauth, wishlistController.removewishlist);
router.post( "/addtocartwishlist", userauth,wishlistController.addtocartwishlist);


module.exports = router;
