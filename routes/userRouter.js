const express = require("express");
const router = express.Router();
const { userauth, adminauth } = require("../middlewares/auth");
const userController = require("../controllers/user/usercontroller");
const passport = require("passport");
const userProfileController = require("../controllers/user/userprofileController");
const cartController = require("../controllers/user/cartController");
const wishlistController = require("../controllers/user/wishlistController");

router.get("/pagenotfound", userController.pagenotfound);
router.get("/", userController.loadHomePage);
router.get("/signup", userController.loadSignup);
router.get("/shop", userController.loadShopping);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendotp);
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get('/referralCodepage',userController.referralCodepage)
router.post('/submitreferral',userController.submitreferral)
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    req.session.user = req.user.id;
    res.redirect("/");
  }
);
router.get("/login", userController.loadlogin);
router.post("/login", userController.login);
router.get("/logout", userauth, userController.logout);

router.get("/product", userauth, userController.loadproduct);
router.get("/product/:id", userController.loadProductDetails);

router.get("/forgotpasswordemail", userController.forgotemailpassword);
router.post("/verify-otp4pass", userController.verifyOtppass);
router.post("/resetpassword", userController.updatepassword);
router.post("/submit-review", userauth, userController.review);
router.post("/delete-review", userauth, userController.deleteReview);

router.get("/profile", userauth, userProfileController.userProfile);
router.post("/update-profile", userauth, userProfileController.edituser);
router.get("/change-password", userauth, userProfileController.changepassword);
router.post(
  "/change-password",
  userauth,
  userProfileController.changenewpassword
);
router.get("/address", userauth, userProfileController.addressmanagement);
router.post("/add-address", userauth, userProfileController.addaddress);
router.put("/editaddresses/:id", userauth, userProfileController.editAddress);
router.get(
  "/editaddresses/:id",
  userauth,
  userProfileController.seteditAddress
);
router.post(
  "/addressesdelete/:id",
  userauth,
  userProfileController.deleteAddress
);
router.get(
  "/download-invoice/:orderId",
  userauth,
  userProfileController.downloadInvoice
);

router.post("/add-to-cart", userauth, cartController.addToCart);
router.get("/cart", userauth, cartController.loadcart);
router.post("/resend-otpforgot", userController.resendotpassword);
router.post("/update-cart-item", userauth, cartController.updateCartItem);
router.post("/remove-cart-item", userauth, cartController.removeCartItem);
router.get("/checkout", userauth, cartController.loadcheckout);
router.post('/checkout',userauth,cartController.postCheckoutValidation)
router.get("/order-success", userauth, cartController.orderSuccess);
router.get("/order-failed", userauth, cartController.orderFailed);
router.post("/place-order", userauth, cartController.placeOrder);
router.post(
  "/handle-razorpay-payment-success",
  userauth,
  cartController.handleRazorpayPaymentSuccess
);
router.post("/order-failed/:orderId", userauth, cartController.markOrderFailed);
router.get("/get-payment-methods", userauth, cartController.getPaymentMethods);
router.post(
  "/create-razorpay-order",
  userauth,
  cartController.createRazorpayOrder
);
router.post(
  "/get-updated-price-details",
  userauth,
  cartController.getUpdatedPriceDetails
);

router.get("/orders/:id", userauth, userProfileController.orderDetails);
router.get("/order-history", userauth, userProfileController.orderHistory);
router.post("/return-order", userauth, userProfileController.returnOrder);
router.post("/cancel-order", userauth, userProfileController.cancelorder);
router.get("/wallet", userauth, userProfileController.loadwallet);
router.post(
  "/create-razorpay-orderonwallet",
  userauth,
  userProfileController.createRazorpayOrd
);
router.post("/verify-payment", userauth, userProfileController.verifypayment);
router.post("/addwishlist", userauth, wishlistController.addwishlist);
router.get("/wishlist", userauth, wishlistController.loadwishlist);
router.post("/remove-wishlist", userauth, wishlistController.removewishlist);
router.post(
  "/addtocartwishlist",
  userauth,
  wishlistController.addtocartwishlist
);
router.post("/save-failed-order", userauth, cartController.saveFailedOrder);
router.post(
  "/retry-razorpay-order",
  userauth,
  userProfileController.retryRazorpayOrder
);
router.post('/retry-wallet-order',userauth,userProfileController.retrywallet)
router.post(
  "/reverify-payment",
  userauth,
  userProfileController.reverifyPayment
);
module.exports = router;
