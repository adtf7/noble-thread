    let User = require("../models/userschema");
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
        console.error(" Error in userAuth middleware:", error);
        return res.status(500).send("Internal Server Error");
      }
    };

    let adminauth = (req, res, next) => {
      if (req.session.admin) {
        return next();
      } else {
        return res.redirect("/admin/admin-login");
      }
    };

    module.exports = {
      adminauth,
      userauth,
    };
