const user = require('../../models/userschema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../../models/userschema'); // Ensure you have the correct path to your User model

let pageerror=async(req,res)=>{
    res.render('admin/pageerror')
}

let loadlogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard'); // Redirect if already logged in
        }
        res.render('admin/admin-login', { message: null });
    } catch (error) {
        console.error('Error loading login page:', error);
        res.status(500).render('admin/pageerror');
    }
};

let loginAdmin = async (req, res) => { 
    console.log('acces')
    let { email, password } = req.body;
    try {
        console.log('email=', email);
        console.log('password', password);
        
        // Find admin user (ensure `isAdmin: true`)
        let admin = await user.findOne({ email, isAdmin: true });
        console.log('admin', admin);
        
        if (!admin) {
            return res.render('admin/admin-login', { message: 'Admin not found' });
        }

        let passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            return res.render('admin/admin-login', { message: 'Incorrect password' });
        }

        req.session.admin = true; // Store session
        return res.redirect('/admin/dashboard'); // Use absolute path

    } catch (error) {
        console.error('Error on login:', error);
        res.status(500).render('admin/pageerror');
    }
};

let logout=async(req,res)=>{
    try{
    req.session.destroy((error)=>{
        if(error){
           console.log('logout error',error)
           return res.status(500).send('internal server error')
        }
        res.redirect('/admin/admin-login')
    })
}catch{
    console.error('Error during logout:', error);
    res.status(500).send('Internal Server Error');
}
}

module.exports = {
    loadlogin,
    loginAdmin,
    
    pageerror,
    logout
};
