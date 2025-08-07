const User = require("../../models/userschema");
let nodemailer = require("nodemailer");
let env = require("dotenv").config();
let bcrypt = require("bcrypt");
let passport = require("../../config/passport");
const category = require("../../models/categorySchema");
const products = require("../../models/productSchema");
const Offer = require("../../models/offerSchema");
let Cart = require("../../models/cartSchema");
let mongoose = require("mongoose");
const Review = require("../../models/reviewSchema");
const Wallet=require('../../models/walletSchema')
const loadHomePage = async (req, res) => {
  try {
    let userId = req.session.user;
    console.log(userId);
    let userdata = null;
    let product = await products.find({});
    if (userId) {
      userdata = await User.findOne({ _id: userId });
    }

    let cartcount = [];
    if (userId) {
      cartcount = await Cart.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$userId",
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
      ]);
    }
    console.log("product=", product);

    console.log("cartcount", cartcount);
    console.log("userdata=", userdata);

    res.render("user/home", {
      user: userdata,
      currentPage: "home",
      product,
      cartcount,
    });
  } catch (error) {
    console.error("Error on home:", error.message);
    res.status(500).send("Internal Server Error");
  }
};
const pagenotfound = async (req, res) => {
  try {
    res.status(404).render("user/page-404");
  } catch (error) {
    console.error("Error loading 404 page:", error.message);
    res.redirect("/");
  }
};
const loadShopping = async (req, res) => {
  try {
    let userId = req.session.user;
    let userdata = null;

    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    console.log("cartcount", cartcount);
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const queryParams = { ...req.query };

    let sortval = req.query.sort;
    let sortObj = {};
    if (sortval) {
      const sortOptions = {
        "price-asc": { salePrice: 1 },
        "price-desc": { salePrice: -1 },
        "name-asc": { productName: 1 },
        "name-desc": { productName: -1 },
      };
      sortObj = sortOptions[sortval] || {};
    }
    let filter = { isBlocked: false };
    if (req.query.minPrice || req.query.maxPrice) {
      filter.salePrice = {};
      if (req.query.minPrice)
        filter.salePrice.$gte = parseInt(req.query.minPrice);
      if (req.query.maxPrice)
        filter.salePrice.$lte = parseInt(req.query.maxPrice);
    }
    if (req.query.search) {
      filter.productName = { $regex: new RegExp(req.query.search, "i") };
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.size) {
      filter.size = req.query.size;
    }
    if (req.query.color) {
      filter.color = { $regex: new RegExp(`^${req.query.color}$`, "i") };
    }

    const totalProducts = await products.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const product = await products
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    const allSizes = await products.distinct("size");
    const categories = await category.find({});
    const allColors = await products.distinct("color");

    if (userId) {
      userdata = await User.findById(userId);
    }

    const buildUrl = (newParams = {}) => {
      const params = { ...queryParams, ...newParams };
      if (params.page === "1") delete params.page;
      return `/shop?${new URLSearchParams(params).toString()}`;
    };

    const paginationLinks = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        paginationLinks.push({
          page: i,
          url: buildUrl({ page: i }),
          active: i === page,
        });
      } else if (i === page - 2 || i === page + 2) {
        paginationLinks.push({ isEllipsis: true });
      }
    }

    res.render("user/shop", {
      user: userdata,
      currentPage: "shop",
      categories,
      product,
      allSizes,
      allColors,
      selectedSize: req.query.size || "",
      selectedCategory: req.query.category || "",
      selectedColor: req.query.color || "",
      currentPageNum: page,
      totalPages,
      searchQuery: req.query.search || "",
      totalProducts,
      sort: sortval,
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      start: totalProducts > 0 ? skip + 1 : 0,
      end: Math.min(skip + limit, totalProducts),
      cartcount,
      paginationLinks,
      prevPageUrl: page > 1 ? buildUrl({ page: page - 1 }) : null,
      nextPageUrl: page < totalPages ? buildUrl({ page: page + 1 }) : null,
      buildUrl,
    });
  } catch (error) {
    console.error("Shop not loading:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

const loadSignup = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("user/signup.ejs", { message: "" });
    } else {
      return res.redirect("/");
    }
  } catch (error) {
    console.error("Cannot reach signup:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

function generateOtp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp);
  return otp;
}

async function sendverificationemail(email, otp) {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    console.log("Loaded Email:", process.env.NODEMAILER_EMAIL);

    let info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Your One-Time (OTP) for NOBLE THREADS",
      text: `Dear User,

Thank you for using our service. To complete your request, please use the following One-Time Password (OTP):

Your OTP: ${otp}

Please enter this OTP within the next minutes to proceed. If you did not request this OTP, please contact our support team immediately at threadnoble1@gmail.com.

Thank you for your cooperation.

Best regards, NOBLE THREADS`,
    });
    console.log("Email sent:", info.accepted);
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    let { name, phone, email, password, confpassword } =
      req.body || passport.session.user;
    console.log("passportdata", passport.body);
    if (!email || !password || !confpassword) {
      return res.render("user/signup.ejs", {
        message: "All fields are required",
      });
    }

    if (password !== confpassword) {
      return res.render("user/signup.ejs", {
        message: "Passwords do not match",
      });
    }

    let finduser = await User.findOne({ email });
    if (finduser) {
      console.log("already exist", finduser);
      return res.render("user/signup.ejs", { message: "User already exists" });
    }

    let otp = generateOtp();

    let emailsend = await sendverificationemail(email, otp);
    console.log("Email send status:", emailsend);

    if (!emailsend) {
      return res.json({ message: "Email sending failed" });
    }

    req.session.userOtp = otp;
    req.session.userdata = { name, phone, email, password };

    console.log("Session OTP:", req.session.userOtp);
    console.log("Session User Data:", req.session.userdata);
    res.render("user/verify-otp.ejs", { message: "" });
  } catch (error) {
    console.error("Signup error:", error);
    res.render("user/page-404.ejs");
  }
};

let securedpass = async (password) => {
  try {
    let passwordhash = await bcrypt.hash(password, 10);
    return passwordhash;
  } catch (error) {
    console.error("Error securing password:", error);
  }
};

let verifyOtp = async (req, res) => {
  try {
    const { enterotp } = req.body;

    console.log("Entered OTP:", enterotp);
    console.log("Session OTP:", req.session.userOtp);
    console.log("Session Data:", req.session);

    if (!enterotp) {
      console.log("No OTP provided");
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }
    if (!/^\d{6}$/.test(enterotp)) {
      console.log("Invalid OTP format");
      return res
        .status(400)
        .json({ success: false, message: "OTP must be a 6-digit number" });
    }

    if (!req.session.userOtp) {
      console.log("No OTP found in session");
      return res
        .status(400)
        .json({
          success: false,
          message: "No OTP found. Please request a new OTP",
        });
    }
    if (!req.session.userdata) {
      console.log("No user data found in session");
      return res
        .status(400)
        .json({
          success: false,
          message: "Session expired or invalid. Please start over",
        });
    }

    if (req.session.otpExpires && req.session.otpExpires < Date.now()) {
      console.log("OTP expired");
      return res
        .status(400)
        .json({
          success: false,
          message: "OTP has expired. Please request a new OTP",
        });
    }

    if (enterotp.toString() === req.session.userOtp.toString()) {
      console.log("OTP matched");

      const userData = req.session.userdata;
      const passwordhash = await securedpass(userData.password);

      if (
        !userData.name ||
        !userData.email ||
        !userData.phone ||
        !userData.password
      ) {
        console.log("Incomplete user data");
        return res
          .status(400)
          .json({
            success: false,
            message: "Incomplete user data. Please start over",
          });
      }

      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log("User already exists");
        return res
          .status(400)
          .json({
            success: false,
            message: "Email already registered. Please log in",
          });
      }

      const saveuserdata = new User({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: passwordhash,
        referralCode:Math.floor(10000000 + Math.random() * 900000).toString()
      });

      await saveuserdata.save();
      req.session.user = saveuserdata._id;

      req.session.userOtp = null;
      req.session.otpExpires = null;
      req.session.userdata = null;

      return res.json({ success: true, redirectUrl: "/referralCodepage" });
    } else {
      console.log("OTP did not match");
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again" });
    }
  } catch (error) {
    console.error("Error on OTP verification:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while verifying the OTP",
      });
  }
};

let referralCodepage=async (req,res)=>{
  try {
    return res.render("user/referralCode.ejs", { message: "" });
  } catch (error) {
     console.error("Error on referralCodepage", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "An error occurred referral Code page",
      });
  }
}

const submitreferral = async (req, res) => {
  try {
    let { referralCode } = req.body;
    let userId = req.session.user;
    console.log('Referral Code:', referralCode);

    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code is required.' });
    }

    let referuser = await User.findOne({ referralCode: referralCode });

    if (!referuser) {
      return res.status(400).json({ success: false, message: 'Invalid Referral Code' });
    }

    const currentUser = await User.findById(userId);
    if (currentUser.referralCode && currentUser.referralCode.includes(referralCode)) {
      return res.status(400).json({ success: false, message: 'Referral code already used.' });
    }

    const rewardAmount = 200; 
    await User.updateOne({ _id: userId }, { $inc: { walletBalance: rewardAmount } });

    let currentWalletData = await Wallet.findOne({ user: new mongoose.Types.ObjectId(userId) });
    if (!currentWalletData) {
      currentWalletData = new Wallet({
        user: new mongoose.Types.ObjectId(userId),
        balance: rewardAmount,
        transactions: []
      });
      await currentWalletData.save();
    } else {
      await Wallet.updateOne({ user: new mongoose.Types.ObjectId(userId) }, { $inc: { balance: rewardAmount } });
    }

    currentWalletData.transactions.push({
      order: null,
      description: 'Referral Code reward',
      amount: rewardAmount,
      status: 'completed',
      type: 'credit',
    });
    await currentWalletData.save();

    const referredRewardAmount = 500;
    await User.updateOne({ _id: referuser._id }, {
      $set: { referralCode: 'Claimed' }, 
      $inc: { walletBalance: referredRewardAmount }, 
    });

    let referredWalletData = await Wallet.findOne({ user: new mongoose.Types.ObjectId(referuser._id) });
    if (!referredWalletData) {
      referredWalletData = new Wallet({
        user: new mongoose.Types.ObjectId(referuser._id),
        balance: referredRewardAmount,
        transactions: []
      });
      await referredWalletData.save();
    } else {
      await Wallet.updateOne({ user: new mongoose.Types.ObjectId(referuser._id) }, { $inc: { balance: referredRewardAmount } });
    }

    referredWalletData.transactions.push({
      order: null,
      description: 'Referral Code reward',
      amount: referredRewardAmount,
      status: 'completed',
      type: 'credit',
    });
    await referredWalletData.save();

    return res.status(200).json({
      success: true,
      message: `Referral code ${referralCode} successfully applied! You received ${rewardAmount} wallet money.`,
      redirectUrl: '/' 
    });

  } catch (error) {
    console.error('Error in submitreferral:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong, please try again later.',
    });
  }
};



let resendotp = async (req, res) => {
  try {
    let { email } = req.session.userdata;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found" });
    }
    let otp = generateOtp();
    req.session.userOtp = otp;
    let emailsent = await sendverificationemail(email, otp);
    if (emailsent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "OTP sent" });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Something went wrong on resend, try again",
        });
    }
  } catch (error) {
    console.error("Error on resend OTP:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error, try again later" });
  }
};

let loadlogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("user/login", { message: null });
    } else {
      return res.redirect("/");
    }
  } catch (error) {
    console.error("Error loading login page:", error);
    res.status(500).render("user/page-404");
  }
};

let login = async (req, res) => {
  try {
    let { email, password } = req.body;
    console.log("login email", email);
    console.log("login password", password);
    let finduser = await User.findOne({ isAdmin: false, email: email });

    if (!finduser) {
      return res.render("user/login", { message: "User not found" });
    }
    if (finduser.isBlocked) {
      req.session.destroy((error) => {
        if (error) {
          console.log(error);
        }
      });
      return res.render("user/login", {
        message: "User blocked by admin" || req.query.msg,
      });
    }
    let isMatch = await bcrypt.compare(password, finduser.password);
    if (!isMatch) {
      return res.render("user/login", { message: "Incorrect password" });
    }
    req.session.user = finduser._id;
    console.log("session user=", req.session.user);
    return res.redirect("/");
  } catch (error) {
    console.error("Error during login:", error);
    return res.render("user/login", {
      message: "Server error, try again later",
    });
  }
};

const googleCallback = async (req, res) => {
  try {
    let finduser = await User.findOne({
      isAdmin: false,
      email: req.user.email,
    });
    if (finduser.isBlocked) {
      return res.render("user/login", { message: "User blocked by admin" });
    }
    req.session.user = req.user._id;
    req.session.username = req.user.name;
    req.session.email = req.user.email;

    console.log("Google User:", req.user);
    console.log("Session:", req.session);

    res.redirect("/");
  } catch (error) {
    console.error("Error during Google callback:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

let logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadproduct = async (req, res) => {
  try {
    let userId = req.session.user;
    let userdata = userId ? await User.findOne({ _id: userId }) : null;
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    let productId = req.query.id;
    console.log("Requested Product ID:", productId);

    let product = await products.findById(productId).populate("category");
    console.log("Product Data:", product);

    if (!product) {
       return res.redirect('/pagenotfound');
    }
    let productCategory = product.category;

    let productOffer = await Offer.findById(product.offer);
    let categoryOffer = await Offer.findById(productCategory.offer);
    let color = await products.distinct("color");
    let productImages = product.productImage || [];
    let allproduct = await products.find({ category: product.category });
    console.log(allproduct);
    let reviews = await Review.find({ product: productId })
      .populate("user", "name profileImage")
      .sort({ createdAt: -1 });
    let largestOffer = 0;

    if (productOffer) {
      largestOffer = productOffer.discountPercentage;
    }

    if (categoryOffer && categoryOffer.discountPercentage > largestOffer) {
      largestOffer = categoryOffer.discountPercentage;
    }
    let discountedPrice = product.salePrice;

    if (largestOffer > 0) {
      discountedPrice = product.salePrice * (1 - largestOffer / 100);
    }
    let rating = 0;
    reviews.forEach((r) => {
      rating = r.rating;
    });
    console.log("Largest Offer:", largestOffer);

    return res.render("user/product-details", {
      user: userdata,
      product,
      color,
      productImages: product.productImage || [],
      currentPage: "shop",
      relatedProducts: "",
      allproduct,
      discountedPrice,
      cartcount,
      reviews,
      rating,
    });
  } catch (error) {
    console.error("Error loading product:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

const loadProductDetails = async (req, res) => {
  try {
    let userId = req.session.user;
    let userdata = userId ? await User.findById(userId) : null;

    let productId = req.params.id || req.query.id;
    console.log("Requested Product ID:", productId);

    let product = await products.findById(productId);
    if (!product) {
      return res.redirect('/pagenotfound');
    }
    let reviews = await Review.find({ product: productId })
      .populate("user", "name profileImage")
      .sort({ createdAt: -1 });
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    let rating = 0;
    reviews.forEach((r) => {
      rating = r.rating;
    });
    let color = await products.distinct("color");

    let relatedProducts = await products
      .find({
        category: product.category,
        _id: { $ne: product._id },
      })
      .limit(4)
      .exec();

    console.log("Related Products:", relatedProducts);
    let allproduct = await products.find({ category: product.category });
    console.log(allproduct);
    return res.render("user/product-details", {
      user: userdata,
      product,
      color,
      productImages: product.productImages || [],
      relatedProducts: relatedProducts || [],
      currentPage: "shop",
      allproduct,
      cartcount,
      reviews,
      rating,
    });
  } catch (error) {
    console.error("Error loading product:", error.message);
    res.status(500).send("Internal Server Error");
  }
};

function generateOtpforforgot() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp); 
    return otp;
}

async function sendverificationemailforgotpass(email, otp) {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    let info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Reset Your Password - NOBLE THREADS",
      text: `Dear User,
        
        You recently requested to reset your password for your NOBLE THREADS account. To complete the process, please use the following One-Time Password (OTP):
        
        Your OTP: ${otp}
        
        Please enter this OTP within the next 10 minutes to proceed with resetting your password. If you did not request this password reset, please contact our support team immediately at threadnoble1@gmail.com.
        
        Thank you for your cooperation.
        
        Best regards,
        
        The NOBLE THREADS Team`,
      html: `<p>Dear User,</p>
                   <p>You recently requested to reset your password for your NOBLE THREADS account. To complete the process, please use the following One-Time Password (OTP):</p>
                   <h2>Your OTP: <b>${otp}</b></h2>
                   <p>Please enter this OTP within the next 10 minutes to proceed with resetting your password. If you did not request this password reset, please contact our support team immediately at <a href="mailto:threadnoble1@gmail.com">threadnoble1@gmail.com</a>.</p>
                   <p>Thank you for your cooperation.</p>
                   <p>Best regards,</p>
                   <p>The NOBLE THREADS Team</p>`,
    });
    console.log("Email sent:", info.accepted); 
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

let forgotemailpassword = async (req, res) => {
  try {
    console.log(req.query);
    let { email } = req.query;
    console.log(email);
    req.session.usermail = email;
    if (typeof email !== "string" || email.trim() === "") {
      return res.render("user/forgotemail.ejs", { message: "" });
    }

    let findemail = await User.findOne({ email: email });
    if (!findemail) {
      return res.render("user/forgotemail.ejs", {
        message: "Invalid email, please enter an existing email",
      });
    } else {
      let otp = generateOtpforforgot();
      req.session.userOtp = otp;

      let emailsend = await sendverificationemailforgotpass(email, otp);
      console.log("Email send status:", emailsend); 

      if (!emailsend) {
        return res.json({ message: "Email sending failed" });
      }

      res.render("user/forgotpasswordotp.ejs", { message: "", email });
    }
  } catch (error) {
    console.error(
      "something error while loading forgot password email registration:",
      error.message
    );
    res.status(500).send("Internal Server Error");
  }
};

let verifyOtppass = async (req, res) => {
  try {
    if (req.session.userOtp) {
      let { otp } = req.body;
      console.log(otp);
      if (req.session.userOtp == otp) {
        res.render("user/forgotpassword", { message: "" });
      } else {
        return res.render("user/forgotpasswordotp.ejs", {
          message: "Enter a valid OTP",
          email: "",
        });
      }
    } else {
      res.render("user/forgotemail", { message: "" });
    }
  } catch (error) {
    console.error(
      "Something error while loading forgot password:",
      error.message
    );
    res.status(500).send("Internal Server Error");
  }
};

let updatepassword = async (req, res) => {
  try {
    let { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.render("user/forgotpassword", {
        message: "Confirm password does not match",
      });
    }

    let mail = req.session.usermail;
    if (!mail) {
      return res.render("user/forgotemail", {
        message: "Session expired. Please start the process again.",
      });
    }

    let hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne(
      { email: mail },
      { $set: { password: hashedPassword } }
    );

    req.session.destroy();

    res.render("user/login", {
      message: "Password updated successfully. Please log in.",
    });
  } catch (error) {
    console.error("Error while updating password:", error.message);
    res.status(500).send("Internal Server Error");
  }
};
let resendotpassword = async (req, res) => {
  try {
    let email = req.session.usermail;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found" });
    }
    let otp = generateOtpforforgot();
    req.session.userOtp = otp;
    let emailsent = await sendverificationemailforgotpass(email, otp);
    if (emailsent) {
      console.log("Resend OTP:", otp);
      res.status(200).json({ success: true, message: "OTP sent" });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Something went wrong on resend, try again",
        });
    }
  } catch (error) {
    console.error("Error on resend OTP:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error, try again later" });
  }
};

let review = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    let userId = req.session.user;
    console.log("rating=", rating);
    if (!productId || !rating || !comment) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }

    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You have already reviewed this product.",
        });
    }

    await Review.create({
      user: userId,
      product: productId,
      rating,
      comment,
    });

    return res
      .status(200)
      .json({ success: true, message: "Review submitted successfully." });
  } catch (error) {
    console.error("Review submit error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error. Please try again later.",
      });
  }
};
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.body;

    if (!reviewId) {
      return res
        .status(400)
        .json({ success: false, message: "Review ID is required" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    await Review.findByIdAndDelete(reviewId);

    return res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error. Please try again later.",
      });
  }
};

module.exports = {
  loadSignup,
  loadHomePage,
  pagenotfound,
  loadShopping,
  signup,
  verifyOtp,
  resendotp,
  loadlogin,
  login,
  review,
  googleCallback,
  logout,
  loadproduct,
  deleteReview,
  forgotemailpassword,
  verifyOtppass,
  updatepassword,
  loadProductDetails,
  resendotpassword,
  referralCodepage,
  submitreferral
};
