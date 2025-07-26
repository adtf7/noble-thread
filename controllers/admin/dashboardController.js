const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema");
let User=require('../../models/userschema')
let category = require("../../models/categorySchema");
let loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/admin-login');
        }

        const excludedStatuses = ["Cancelled", "Returned", "Failed"];

        // Total Revenue
        const totalRevenue = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses } } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        // Yearly Revenue
        const yearlyRevenue = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses } } },
            {
                $group: {
                    _id: { $year: "$createdOn" },
                    total: { $sum: "$finalAmount" }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    year: "$_id",
                    total: 1,
                    _id: 0
                }
            }
        ]);

        const monthlyRevenue = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses }, createdOn: { $gte: new Date(new Date().getFullYear(), 0, 1) } } },
            {
                $group: {
                    _id: { $month: "$createdOn" },
                    total: { $sum: "$finalAmount" }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    month: "$_id",
                    total: 1,
                    _id: 0
                }
            }
        ]);

        const weeklyRevenue = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses }, createdOn: { $gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) } } },
            {
                $group: {
                    _id: { $week: "$createdOn" },
                    total: { $sum: "$finalAmount" }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    week: "$_id",
                    total: 1,
                    _id: 0
                }
            }
        ]);

        const totalUsers = await User.countDocuments({});
        const totalOrders = await Order.countDocuments({ status: { $nin: excludedStatuses } });
        const pendingOrders = await Order.countDocuments({ status: "Pending" });
        const recentOrders = await Order.find({ status: { $nin: excludedStatuses } })
            .sort({ createdOn: -1 })
            .limit(5)
            .populate('userId', 'name email');
        const totalProducts = await Product.countDocuments({});
        const totalcategories = await category.countDocuments({});

        const bestSellingProducts = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses } } },
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

        const bestSellingCategories = await Order.aggregate([
            { $match: { status: { $nin: excludedStatuses } } },
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
            { $limit: 10 },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $project: {
                    categoryName: "$category.name",
                    totalSold: 1
                }
            }
        ]);

        const revenueData = {
            yearly: {
                labels: yearlyRevenue.map(item => item.year.toString()),
                data: yearlyRevenue.map(item => item.total)
            },
            monthly: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                data: Array(12).fill(0).map((_, i) => {
                    const monthData = monthlyRevenue.find(item => item.month === i + 1);
                    return monthData ? monthData.total : 0;
                })
            },
            weekly: {
                labels: weeklyRevenue.map((item, index) => `Week ${index + 1}`),
                data: weeklyRevenue.map(item => item.total)
            }
        };

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
            bestSellingCategories,
            revenueData: JSON.stringify(revenueData) ,
            yearlyRevenue,
            monthlyRevenue,
            weeklyRevenue
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).render('admin/pageerror');
    }
};

module.exports = {
    loadDashboard
}