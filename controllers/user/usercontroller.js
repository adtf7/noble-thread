const User = require('../../models/userschema');
let nodemailer = require('nodemailer');
let env = require('dotenv').config();
let bcrypt = require('bcrypt');
let passport = require('../../config/passport');
const category = require('../../models/categorySchema');
const products = require('../../models/productSchema');
const Offer=require('../../models/offerSchema')
let Cart=require('../../models/cartSchema')
let mongoose=require('mongoose')
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
        if (userId) {  // Only run aggregation if user is logged in
            cartcount = await Cart.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId) } },
                { $unwind: '$items' }, 
                { $group: {
                    _id: '$userId',
                    totalItems: { $sum: 1 },
                    totalQuantity: { $sum: '$items.quantity' } 
                }}
            ]);
        }

        console.log('cartcount', cartcount);
        console.log('userdata=', userdata);
        
        res.render('user/home', { 
            user: userdata, 
            currentPage: 'home',
            product,
            cartcount
        });
    } catch (error) {
        console.error('Error on home:', error.message);
        res.status(500).send('Internal Server Error');
    }
};
const pagenotfound = async (req, res) => {
    try {
        res.status(404).render('user/page-404');
    } catch (error) {
        console.error('Error loading 404 page:', error.message);
        res.redirect('/');
    }
};
const loadShopping = async (req, res) => {
    try {
        let userId = req.session.user;
        let userdata = null;

        const cartcount = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: '$items' },
            { $group: {
                _id: '$userId',
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: '$items.quantity' }
              }
            }
        ]);

        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Get all query parameters to maintain them in pagination links
        const queryParams = { ...req.query };

        let sortval = req.query.sort;
        let sortObj = {};
        if (sortval) {
            const sortOptions = {
                "price-asc": { salePrice: 1 },
                "price-desc": { salePrice: -1 },
                "name-asc": { productName: 1 },
                "name-desc": { productName: -1 }
            };
            sortObj = sortOptions[sortval] || {};
        }

        // Filtering setup
        let filter = { isBlocked: false }; // Only show non-blocked products
        if (req.query.minPrice || req.query.maxPrice) {
            filter.salePrice = {};
            if (req.query.minPrice) filter.salePrice.$gte = parseInt(req.query.minPrice);
            if (req.query.maxPrice) filter.salePrice.$lte = parseInt(req.query.maxPrice);
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

        const product = await products.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limit);

        const allSizes = await products.distinct('size');
        const categories = await category.find({});
        const allColors = await products.distinct('color');

        if (userId) {
            userdata = await User.findById(userId);
        }

        // Function to build URL with all current query parameters
        const buildUrl = (newParams = {}) => {
            const params = { ...queryParams, ...newParams };
            // Remove page if it's 1 to keep URLs clean
            if (params.page === '1') delete params.page;
            return `/shop?${new URLSearchParams(params).toString()}`;
        };

        // Generate pagination links
        const paginationLinks = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
                paginationLinks.push({
                    page: i,
                    url: buildUrl({ page: i }),
                    active: i === page
                });
            } else if (i === page - 2 || i === page + 2) {
                paginationLinks.push({ isEllipsis: true });
            }
        }

        res.render('user/shop', {
            user: userdata,
            currentPage: 'shop',
            categories,
            product,
            allSizes,
            allColors,
            selectedSize: req.query.size || '',
            selectedCategory: req.query.category || '',
            selectedColor: req.query.color || '',
            currentPageNum: page, // Renamed to avoid conflict with 'currentPage'
            totalPages,
            searchQuery: req.query.search || '',
            totalProducts,
            sort: sortval,
            minPrice: req.query.minPrice || '',
            maxPrice: req.query.maxPrice || '',
            start: totalProducts > 0 ? skip + 1 : 0,
            end: Math.min(skip + limit, totalProducts),
            cartcount: cartcount.length > 0 ? cartcount[0] : { totalItems: 0, totalQuantity: 0 },
            paginationLinks,
            prevPageUrl: page > 1 ? buildUrl({ page: page - 1 }) : null,
            nextPageUrl: page < totalPages ? buildUrl({ page: page + 1 }) : null,
            buildUrl // Pass the function to the view
        });

    } catch (error) {
        console.error('Shop not loading:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const loadSignup = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('user/signup.ejs',{message:''});
        } else {
            return res.redirect('/');
        }
    } catch (error) {
        console.error('Cannot reach signup:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

const loadContactPage = async (req, res) => {
    try {
        let userId = req.session.user;
        let userdata = null;
        const cartcount = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: '$items' }, 
            { $group: {
                _id: '$userId',
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: '$items.quantity' } 
              }
            }
          ]);
        if (userId) {
            userdata = await User.findOne({ _id: userId });
        }
        res.render('user/contact', { user: userdata, currentPage: 'contact' ,cartcount});
    } catch (error) {
        console.error('Error loading contact page:', error.message);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};

function generateOtp() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated OTP:', otp); // Debugging statement
    return otp;
}

async function sendverificationemail(email, otp) {
    try {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });
        let info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Your One-Time (OTP) for NOBLE THREADS',
            text: `Dear User,

Thank you for using our service. To complete your request, please use the following One-Time Password (OTP):

Your OTP: ${otp}

Please enter this OTP within the next minutes to proceed. If you did not request this OTP, please contact our support team immediately at threadnoble1@gmail.com.

Thank you for your cooperation.

Best regards, NOBLE THREADS`,
        });
        console.log('Email sent:', info.accepted); // Debugging statement
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

const signup = async (req, res) => {
    try {
        let { name, phone, email, password, confpassword } = req.body || passport.session.user;
        console.log('passportdata', passport.body);
        if (!email || !password || !confpassword) {
            return res.render('user/signup.ejs', { message: 'All fields are required' });
        }

        if (password !== confpassword) {
            return res.render('user/signup.ejs', { message: 'Passwords do not match' });
        }

        let finduser = await User.findOne({ email });
        if (finduser) {
            console.log('already exist',finduser)
            return res.render('user/signup.ejs', { message: 'User already exists' });
        }

        let otp = generateOtp();

        let emailsend = await sendverificationemail(email, otp);
        console.log('Email send status:', emailsend); // Debugging statement

        if (!emailsend) {
            return res.json({ message: 'Email sending failed' });
        }

        req.session.userOtp = otp;
        req.session.userdata = { name, phone, email, password };

        console.log('Session OTP:', req.session.userOtp); // Debugging statement
        console.log('Session User Data:', req.session.userdata); // Debugging statement

        res.render('user/verify-otp.ejs', { message: '' });

    } catch (error) {
        console.error('Signup error:', error);
        res.render('user/page-404.ejs');
    }
};

let securedpass = async (password) => {
    try {
        let passwordhash = await bcrypt.hash(password, 10);
        return passwordhash;
    } catch (error) {
        console.error('Error securing password:', error);
    }
};

let verifyOtp = async (req, res) => {
    try {
        let { enterotp } = req.body;
        console.log("Entered OTP:", enterotp);
        console.log("Session OTP:", req.session.userOtp);
        console.log("Session Data:", req.session);

        // Ensure both values are treated as strings before comparison
        if (enterotp.toString() === req.session.userOtp.toString()) {
            console.log('OTP matched');

            let userData = req.session.userdata;
            let passwordhash = await securedpass(userData.password);

            let saveuserdata = new User({
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: passwordhash
            });

            await saveuserdata.save();
            req.session.user = saveuserdata._id;

            return res.json({ success: true, redirectUrl: "/" });
        } else {
            console.log('OTP did not match');
            return res.status(400).json({ success: false, message: 'Invalid OTP, try again' });
        }
    } catch (error) {
        console.error('Error on OTP verification:', error);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
};

let resendotp = async (req, res) => {
    try {
        let { email } = req.session.userdata;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found' });
        }
        let otp = generateOtp();
        req.session.userOtp = otp;
        let emailsent = await sendverificationemail(email, otp);
        if (emailsent) {
            console.log('Resend OTP:', otp);
            res.status(200).json({ success: true, message: 'OTP sent' });
        } else {
            res.status(500).json({ success: false, message: 'Something went wrong on resend, try again' });
        }
    } catch (error) {
        console.error('Error on resend OTP:', error);
        res.status(500).json({ success: false, message: 'Server error, try again later' });
    }
};

let loadlogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('user/login', { message: null });
        } else {
            return res.redirect('/');
        }
    } catch (error) {
        console.error('Error loading login page:', error);
        res.status(500).render('user/page-404');
    }
};

let login = async (req, res) => {
    try {
        let { email, password } = req.body;
        console.log('login email', email);
        console.log('login password', password);
        let finduser = await User.findOne({ isAdmin: false, email: email });
     
        if (!finduser) {
           
            return res.render('user/login', { message: 'User not found' });
        }
        if (finduser.isBlocked) {
            req.session.destroy((error)=>{
                if(error){
                    console.log(error)
                }
            })
            return res.render('user/login', { message: 'User blocked by admin'||req.query.msg });
        }
        let isMatch = await bcrypt.compare(password, finduser.password);
        if (!isMatch) {
            return res.render('user/login', { message: 'Incorrect password' });
        }
        req.session.user = finduser._id;
        console.log('session user=', req.session.user);
        return res.redirect('/');

    } catch (error) {
        console.error('Error during login:', error);
        return res.render('user/login', { message: 'Server error, try again later' });
    }
};

const googleCallback = async (req, res) => {
    try {
        let finduser = await User.findOne({ isAdmin: false, email: req.user.email });
        if (finduser.isBlocked) {
            return res.render('user/login', { message: 'User blocked by admin' });
        }
        req.session.user = req.user._id;
        req.session.username = req.user.name;
        req.session.email = req.user.email;

        console.log('Google User:', req.user); // Debugging
        console.log('Session:', req.session);

        res.redirect('/');
    } catch (error) {
        console.error('Error during Google callback:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

let logout = async (req, res) => {
    try {
       
            req.session.destroy((err) => {
                if (err) {
                    console.log('Error destroying session:', err);
                    return res.status(500).send('Internal Server Error');
                }
                res.redirect('/'); // Redirect to login page after logout
            });
        
        
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).send('Internal Server Error');
    }
};



// Load all products for listing
const loadproduct = async (req, res) => {
    try {
        let userId = req.session.user;
        let userdata = userId ? await User.findOne({ _id: userId }) : null;
        const cartcount = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: '$items' }, 
            { $group: {
                _id: '$userId',
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: '$items.quantity' } 
              }
            }
          ]);
        let productId = req.query.id;
        console.log("Requested Product ID:", productId);
      
        // Fetch product details
        let product = await products.findById(productId).populate('category');
        console.log("Product Data:", product);
        
        if (!product) {
            return res.status(404).send("Product not found");
        }
        let productCategory = product.category;


        let productOffer = await Offer.findById(product.offer);
        let categoryOffer = await Offer.findById(productCategory.offer);
        let color = await products.distinct('color');
        let productImages = product.productImage || []; // Ensure it's always an array
        let allproduct = await products.find({category:product.category}) 
        console.log(allproduct)

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
        console.log('Largest Offer:', largestOffer);

        return res.render('user/product-details', {
            user: userdata,
            product,
            color,
            productImages: product.productImage || [],
            currentPage: 'shop',
            relatedProducts:'',
            allproduct,
            discountedPrice,
            cartcount
        });
        
    } catch (error) {
        console.error('Error loading product:', error.message);
        res.status(500).send('Internal Server Error');
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
            return res.status(404).send("Product not found");
        }
        const cartcount = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: '$items' }, 
            { $group: {
                _id: '$userId',
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: '$items.quantity' } 
              }
            }
          ]);
        let color = await products.distinct('color');

        // Fetch related products (ensure it always returns an array)
        let relatedProducts = await products.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4).exec();
        
        console.log("Related Products:", relatedProducts); // Debugging
        let allproduct = await products.find({category:product.category}) 
        console.log(allproduct)
        return res.render('user/product-details', {
            user: userdata,
            product,
            color,
            productImages: product.productImages || [],
            relatedProducts: relatedProducts || [], // Always pass an array
            currentPage: 'shop',
            allproduct,
            cartcount
        });

    } catch (error) {
        console.error('Error loading product:', error.message);
        res.status(500).send('Internal Server Error');
    }
};




function generateOtpforforgot() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated OTP:', otp); // Debugging statement
    return otp;
}

async function sendverificationemailforgotpass(email, otp) {
    try {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });
        let info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Reset Your Password - NOBLE THREADS',
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
                   <p>The NOBLE THREADS Team</p>`
        });
        console.log('Email sent:', info.accepted); // Debugging statement
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

let forgotemailpassword = async (req, res) => {
    try {
        console.log(req.query); // Log the complete req.query
        let { email } = req.query; // Destructure email from req.query
        console.log(email); // Log the email for debugging
        req.session.usermail = email;
        if (typeof email !== 'string' || email.trim() === '') {
            return res.render('user/forgotemail.ejs', { message: '' });
        }

        let findemail = await User.findOne({ email: email });
        if (!findemail) {
            return res.render('user/forgotemail.ejs', { message: 'Invalid email, please enter an existing email' });
        } else {
            let otp = generateOtpforforgot();
            req.session.userOtp = otp;

            let emailsend = await sendverificationemailforgotpass(email, otp);
            console.log('Email send status:', emailsend); // Debugging statement

            if (!emailsend) {
                return res.json({ message: 'Email sending failed' });
            }

            res.render('user/forgotpasswordotp.ejs', { message: '', email });
        }
    } catch (error) {
        console.error('something error while loading forgot password email registration:', error.message);
        res.status(500).send('Internal Server Error');
    }
};


let verifyOtppass = async (req, res) => {
    try {
        if (req.session.userOtp) {
            let { otp } = req.body; // Use req.body to get the OTP from the POST request
            console.log(otp);
            if (req.session.userOtp == otp) {
                res.render('user/forgotpassword',{message:''});
            } else {
                return res.render('user/forgotpasswordotp.ejs', { message: 'Enter a valid OTP' ,email:''});
            }
        } else {
            res.render('user/forgotemail', { message: '' });
        }
    } catch (error) {
        console.error('Something error while loading forgot password:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

let updatepassword = async (req, res) => {
    try {
        let { newPassword, confirmPassword } = req.body;
        
        // Check if passwords match
        if (newPassword !== confirmPassword) {
            return res.render('user/forgotpassword', { message: 'Confirm password does not match' });
        }

        // Check if session contains the user's email
        let mail = req.session.usermail;
        if (!mail) {
            return res.render('user/forgotemail', { message: 'Session expired. Please start the process again.' });
        }

        // Hash the new password
        let hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        await User.updateOne({ email: mail }, { $set: { password: hashedPassword } });

        // Clear the session
        req.session.destroy();

        // Redirect to login page with success message
        res.render('user/login', { message: 'Password updated successfully. Please log in.' });
    } catch (error) {
        console.error('Error while updating password:', error.message);
        res.status(500).send('Internal Server Error');
    }
};
let resendotpassword = async (req, res) => {
    try {
        let  email  = req.session.usermail;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found' });
        }
        let otp = generateOtpforforgot();
        req.session.userOtp = otp;
        let emailsent = await sendverificationemailforgotpass(email, otp);
        if (emailsent) {
            console.log('Resend OTP:', otp);
            res.status(200).json({ success: true, message: 'OTP sent' });
        } else {
            res.status(500).json({ success: false, message: 'Something went wrong on resend, try again' });
        }
    } catch (error) {
        console.error('Error on resend OTP:', error);
        res.status(500).json({ success: false, message: 'Server error, try again later' });
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
    loadContactPage,
    googleCallback,
    logout,
    loadproduct,
    
    forgotemailpassword,
    verifyOtppass,
    updatepassword,
    loadProductDetails,
    resendotpassword
};
