const User = require('../../models/userschema');

let customer = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/admin-login');
        }
       
        let search = req.query.search || ""; 
        let page = parseInt(req.query.page) || 1; 
        const limit = 5; 

        
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ]
        })
        .limit(limit)
        .skip((page - 1) * limit);

        
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ],
        });

        res.render('admin/customer', { 
            currentPage: 'customers', 
            users: userData, 
            search, 
            page, 
            count,
            totalPages: Math.ceil(count / limit) // Calculate total pages for pagination
        });

    } catch (error) {
        console.error('Error loading customers:', error);
        res.status(500).send('Internal Server Error');
    }
};

let blockuser = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/customers');
    } catch (error) {
        console.log('error on blocking user', error);
        res.redirect('/admin/pageerror');
    }
};

let unblockuser = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect('/admin/customers');
    } catch (error) {
        console.log('error on unblocking user', error);
        res.redirect('/admin/pageerror');
    }
};

module.exports = {
    customer,
    blockuser,
    unblockuser
};