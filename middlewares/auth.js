let User = require('../models/userschema');
let userauth = async (req, res, next) => {
    try {
        if (req.session.user) {
            const users = await User.findById(req.session.user);

            if (users && !users.isBlocked) {
                req.users = users;
                return next();
            } else {
                req.session.user = null;
                return res.redirect("/login?msg=You+are+blocked");
            }
        }
        return res.redirect("/login?msg=Please+log+in");
    } catch (error) {
        console.error("🔥 Error in userAuth middleware:", error);
        return res.status(500).send("Internal Server Error");
    }
};

// const checkBlocked = async (req, res, next) => {
//     try {
//         if (!req.session.user) {
//             console.log('No session user, proceeding...');
//             return next(); // No user session, allow access
//         }

//         console.log("Session User ID:", req.session.user);

//         const user = await User.findById(req.session.user);
        
//         if (!user) {
//             console.log("User not found in database, clearing session...");
//             req.session.destroy(() => {}); // Destroy session if user is missing
//             return res.redirect('/login');
//         }

//         console.log("User found:", user);
//         if(user){
//         if (user.isBlocked) {
//             console.log("Blocked user detected. Destroying session...");
//             req.session.destroy((err) => {
//                 if (err) {
//                     console.error("Error destroying session:", err);
//                     return res.redirect('/admin/pageError'); 
//                 }
//                 return res.redirect('/login'); 
//             });
//             return;
//         }

//         next(); // Proceed if user is not blocked
//     }
//     else{
//         return next()
//     }
//     } catch (error) {
//         console.error("Error in checkBlocked middleware:", error);
//         return res.redirect('/admin/pageError');
//     }
// };



let adminauth = (req, res, next) => {
    if (req.session.admin) {
        return next();
    } else {
        return res.redirect('/admin/admin-login');
    }
};

module.exports = {
    adminauth,
    userauth,
   // checkBlocked
};
