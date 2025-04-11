const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema");
let User=require('../../models/userschema')
let category = require("../../models/categorySchema");
let loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/admin-login');
        }
        else{
            let user=await User.find({})
            const totalRevenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$finalAmount" } } }]);
            let totalUsers=await User.countDocuments({})
            let totalOrders=await Order.countDocuments({})
            let pendingOrders = await Order.countDocuments({
              status: "Pending",
            });
            const recentOrders = await Order.find().sort({ date: -1 }).limit(5) .populate('userId', 'name email');
            let totalProducts=await Product.countDocuments({})
            let totalcategories=await category.countDocuments({})
            const bestSellingProducts = await Order.aggregate([
                { $unwind: "$orderItems" },
                {
                    $group: {
                        _id: "$orderItems.product",
                        totalSold: { $sum: "$orderItems.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                { $project: { name: "$product.productName", totalSold: 1 } }
            ]);
    
            // Simplified Best Selling Categories (Top 10)
            const bestSellingCategories = await Order.aggregate([
                { $unwind: "$orderItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.product",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.category",
                        totalSold: { $sum: "$orderItems.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]);
          
        res.render('admin/dashboard', {
             currentPage: 'dashboard',
             totalUsers,
             totalOrders,
             totalRevenue: totalRevenue[0]?.total || 0,
             pendingOrders,
             recentOrders,
             totalProducts,
             totalcategories,
             bestSellingProducts,
             bestSellingCategories
            });}
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('admin/pageerror');
    }
};

module.exports = {
    loadDashboard
}