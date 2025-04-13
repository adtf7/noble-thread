const Product = require('../../models/productSchema');
const User = require('../../models/userschema');
const Category = require('../../models/categorySchema');
const Address = require('../../models/addressSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const wallet = require("../../models/walletSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');
let Cart=require('../../models/cartSchema')
let mongoose=require('mongoose')
const userProfile = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    try {
        let userId = req.session.user;
        let userdata = await User.findById(userId);     
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
        res.render('user/userprofile', {
            user: userdata,
            currentPage: 'profile',
            cartcount
            
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.redirect('/pagenotfound');
    }
};

let edituser = async (req, res) => {
    try {
        let { name, phone } = req.body;
        let userId = req.session.user;
        console.log('name', name);
        console.log('phone', phone);
        console.log('userId', userId);
        let userupdate = await User.findByIdAndUpdate(
            userId,
            { $set: { name: name, phone: phone } },
            { new: true }
        );
        if (userupdate) {
            return res.json({ success: true, message: "user updated successfully" }); // ✅ JSON response
        } else {
            return res.status(404).json({ error: "user not found" });
        }
    } catch (error) {
        console.error('Error profile editing:', error);
        res.redirect('/pagenotfound');
    }
};

let changepassword = async (req, res) => {
    try {
        res.render('user/changepassword');
    } catch (error) {
        console.error('Error change password:', error);
        res.redirect('/pagenotfound');
    }
};

let changenewpassword = async (req, res) => {
    try {
        let { password, confirmPassword } = req.body;
        let userId = req.session.user;

        if (!password || !confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords required" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        let hashedPassword = await bcrypt.hash(password, 10);
        let updated = await User.updateOne({ _id: userId }, { $set: { password: hashedPassword } });

        if (updated.modifiedCount > 0) {
            return res.json({ success: true, redirect: "/profile" }); // Return JSON instead of redirecting
        } else {
            return res.json({ success: false, message: "Failed to update password" });
        }
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: "Server error. Try again later." });
    }
};

let addressmanagement = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    try {
        let userId = req.session.user;
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
        let userAddresses = await Address.find({ userid: userId });
        let user=await User.findById(userId)
        console.log(userAddresses);
        res.render('user/address', {
            currentPage: 'addresses',
            addresses: userAddresses,
            user:user,
            cartcount
        });
    } catch (error) {
        console.error("Error retrieving address:", error);
        res.redirect('/pagenotfound');
    }
};

let addaddress = async (req, res) => {
    try {

        let userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
       
        let { name, addressLine1, city, state, postalCode, Phone, landmark } = req.body;
        
   
        if (!name || !addressLine1 || !city || !state || !postalCode || !Phone || !landmark) {
            return res.status(400).json({ success: false, message: "Please fill all required fields" });
        }

        
        const newAddress = new Address({
            userid: userId,
           address:[ {
            name:name,
            addressType:addressLine1,
            city: city,
            state: state,
            pincode: postalCode,
           phone: Phone,
            landMark:landmark
        }
        ]
        });

       
        await newAddress.save();

        return res.json({
            success: true,
            message: "Address saved successfully!",
            address: newAddress
        });
    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).json({
            success: false,
            message: "Server error while saving address. Try again later."
        });
    }
};

let seteditAddress = async (req, res) => {
    try {
        let userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        
         const addressId = req.params.id;
        
        let addressDoc = await Address.findOne({ _id: addressId, userid: userId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }
        
        return res.json({
            success: true,
            address: addressDoc.address[0]
        });
    } catch (error) {
        console.error("Error fetching address details:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching address details. Try again later."
        });
    }
};

let editAddress = async (req, res) => {
    try {
        let userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        

        const addressId = req.params.id;
        console.log('addressId:', addressId);
        
       
        let { name, addressLine1, city, state, postalCode, Phone, landmark } = req.body;
  
        // Basic validation.
        if (!name || !addressLine1 || !city || !state || !postalCode || !Phone || !landmark) {
          return res.status(400).json({ success: false, message: "Please fill all required fields" });
        }
  
        let updateResult = await Address.updateOne(
            { _id: addressId, userid: userId },
            { $set: {
                "address.0.name": name,
                "address.0.addressType": addressLine1,
                "address.0.city": city,
                "address.0.state": state,
                "address.0.pincode": postalCode,
                "address.0.phone": Phone,
                "address.0.landMark": landmark
            } }
        );
  
        if (updateResult.modifiedCount > 0) {
            return res.json({ success: true, message: "Address updated successfully!" });
        } else {
            return res.status(404).json({ success: false, message: "Address not found or no changes made." });
        }
    } catch (error) {
        console.error("Error updating address:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating address. Try again later."
        });
    }
};

let deleteAddress = async (req, res) => {
    try {
        let userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        
        const addressId = req.params.id;
        console.log('Deleting address with id:', addressId);
        
        let deleteResult = await Address.deleteOne({ _id: addressId, userid: userId });
        
        if (deleteResult.deletedCount > 0) {
            return res.json({ success: true, message: "Address deleted successfully!" });
        } else {
            return res.status(404).json({ success: false, message: "Address not found." });
        }
    } catch (error) {
        console.error("Error deleting address:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting address. Try again later."
        });
    }
};

let orderDetails = async (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    let userId = req.session.user;
    try {
      let user = await User.findById(userId);
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
      let order;
      if (req.params.id) {
        order = await Order.findOne({ _id: req.params.id, userId: userId })
          .populate('orderItems.product')
          .populate('address');
      } else {
        let orders = await Order.find({ userId: userId })
          .sort({ createdOn: -1 })
          .populate('orderItems.product')
          .populate('address');
        order = orders.length > 0 ? orders[0] : null;
      }
      
      res.render('user/order-details', { order, currentPage: 'orders', user, cartcount });
    } catch (error) {
      console.error("Error retrieving order details:", error);
      res.redirect('/pagenotfound');
    }
  };

  let orderHistory = async (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    let userId = req.session.user;
    
    try {
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 5; // Default to 5 orders per page
      
      let user = await User.findById(userId);
      
      // Get total count of orders
      const totalOrders = await Order.countDocuments({ userId: userId });
      const totalPages = Math.ceil(totalOrders / limit);
      
      // Fetch paginated orders
      let orders = await Order.find({ userId: req.session.user })
        .sort({ createdOn: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('orderItems.product')   
        .populate('address');
        
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
  
      res.render('user/order-history', { 
        orders, 
        user, 
        currentPage: 'orders',
        cartcount,
        totalPages,
        page,
        limit
      });
    } catch (error) {
      console.error("Error retrieving order history:", error);
      res.redirect('/pagenotfound');
    }
  };
const returnOrder = async (req, res) => {
    try {
        const { orderId, itemId, returnReason } = req.body;
        const userId = req.session.user;

        if (!orderId || !itemId || !returnReason) {
            return res.status(400).json({ success: false, message: "Order ID, item ID, and return reason are required." });
        }

        // Find the order for the user
        let order = await Order.findOne({ _id: orderId, userId: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Find the specific item in the order
        const item = order.orderItems.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in the order." });
        }

        // Check if the item is eligible for return
        if (item.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Only delivered items can be returned." });
        }

        if (item.status === 'Return Request' || item.status === 'Returned') {
            return res.status(400).json({ success: false, message: "Item is already requested for return or returned." });
        }

        // Update the item's status and reason (DON'T process refund yet)
        item.status = 'Return Request';
        item.returnReason = returnReason;

        // Create a pending transaction record (but don't add to wallet balance yet)
        await wallet.updateOne(
            { user: order.userId },
            {
                $push: {
                    transactions: {
                        order: order._id,
                        item: item._id,
                        description: `Pending refund for return request of item in order #${order._id}`,
                        amount: item.price * item.quantity,
                        date: new Date(),
                        status: 'pending', 
                        type: 'credit',
                    },
                },
            },
            { upsert: true }
        );

        await order.save();
        return res.json({ success: true, message: "Return request submitted successfully. Refund will be processed after approval." });
    } catch (error) {
        console.error("Error submitting return request:", error);
        res.status(500).json({ success: false, message: "Server error while submitting return request. Try again later." });
    }
};

const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action } = req.body;

        if (!orderId || !itemId || !action) {
            return res.status(400).json({ success: false, message: "Order ID, item ID, and action are required." });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const item = order.orderItems.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in the order." });
        }

        if (item.status !== 'Return Request') {
            return res.status(400).json({ success: false, message: "No return request found for this item." });
        }

        if (action === 'approve') {
            item.status = 'Returned';
            const refundAmount = item.price * item.quantity;

            // Update product stock
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            );

            // Only now add the amount to wallet balance
            await wallet.updateOne(
                { user: order.userId },
                {
                    $inc: { balance: refundAmount },
                    $set: { 
                        'transactions.$[elem].status': 'completed' 
                    }
                },
                {
                    arrayFilters: [
                        { 
                            'elem.order': order._id,
                            'elem.item': item._id,
                            'elem.status': 'pending'
                        }
                    ]
                }
            );

        } else if (action === 'reject') {
            item.status = 'Delivered';

            // Simply remove the pending transaction
            await wallet.updateOne(
                { user: order.userId },
                {
                    $pull: {
                        transactions: {
                            order: order._id,
                            item: item._id,
                            status: 'pending'
                        }
                    }
                }
            );
        } else {
            return res.status(400).json({ success: false, message: "Invalid action." });
        }

        await order.save();
        return res.json({ success: true, message: `Return request ${action}d successfully.` });
    } catch (error) {
        console.error("Error handling return request:", error);
        res.status(500).json({ success: false, message: "Server error while handling return request. Try again later." });
    }
};
const cancelorder = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;

        if (!orderId || !itemId || !reason) {
            return res.status(400).json({ success: false, message: "Order ID, item ID, and reason are required." });
        }

        // Fetch the order without modifying it yet
        const order = await Order.findById(orderId).populate('orderItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const item = order.orderItems.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in the order." });
        }

        if (item.status !== 'Pending' && item.status !== 'Processing') {
            return res.status(400).json({ success: false, message: "Item cannot be canceled at this stage." });
        }

        if (item.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: "Item is already canceled." });
        }

        // Calculate refund amount based on shipping method
        let refundAmount = 0;
        if (order.shoppingMethod !== 'COD') {
            refundAmount = item.price * item.quantity;
        }

        // Use $set to update only the specific orderItem and finalAmount (if applicable)
        const updateFields = {
            'orderItems.$[item].status': 'Cancelled',
            'orderItems.$[item].cancelReason': reason,
        };
        if (refundAmount > 0) {
            updateFields.finalAmount = order.finalAmount - refundAmount;
        }

        // Perform the atomic update on the order
        await Order.updateOne(
            { _id: orderId },
            { $set: updateFields },
            { arrayFilters: [{ 'item._id': itemId }] }
        );

        // Restock the product
        await Product.updateOne(
            { _id: item.product._id },
            { $inc: { quantity: item.quantity } }
        );

        // Update wallet only for non-COD orders with a refund
        if (refundAmount > 0) {
            await wallet.updateOne(
                { user: order.userId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            order: order._id,
                            item: item._id,
                            description: `Refund for canceling item in order #${order._id}`,
                            amount: refundAmount,
                            date: new Date(),
                            status: 'completed',
                            type: 'credit',
                        },
                    },
                },
                { upsert: true }
            );
        }

        return res.json({ success: true, message: "Item canceled successfully." });
    } catch (error) {
        console.error("Error handling item cancel request:", error);
        res.status(500).json({ success: false, message: "Server error while handling cancel request." });
    }
};

    const loadwallet = async (req, res) => {
        try {
            const user = req.session.user;
            const page = parseInt(req.query.page) || 1; // Default to page 1
            const limit = parseInt(req.query.limit) || 4; // Default to 4 transactions per page
    
            // Fetch user data
            const userdata = await User.findById(user);
    
            // Fetch wallet data
            let walletdata = await wallet.findOne({ user: user }).populate({
                path: 'transactions.order', // Populate the order field in transactions
            });
            const cartcount = await Cart.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(user) } },
                { $unwind: '$items' }, 
                { $group: {
                    _id: '$userId',
                    totalItems: { $sum: 1 },
                    totalQuantity: { $sum: '$items.quantity' } 
                  }
                }
              ]);
            // If no wallet exists, create a new one
            if (!walletdata) {
                walletdata = new wallet({
                    user: user,
                    balance: 0,
                    transactions: [],
                });
                await walletdata.save();
            }
    
            // Sort transactions by date (newest first)
            walletdata.transactions.sort((a, b) => b.date - a.date);
    
            // Count total transactions
            const totalTransactions = walletdata.transactions.length;
    
            // Calculate total pages
            const totalPages = Math.ceil(totalTransactions / limit);
    
            // Paginate transactions
            const paginatedTransactions = walletdata.transactions
                .slice((page - 1) * limit, page * limit); // Slice the transactions array for pagination
    
            // Render the wallet page
            res.render("user/wallet", {
                user: userdata,
                wallet: walletdata,
                currentPage: "wallet",
                balance: walletdata.balance,
                transactions: paginatedTransactions, // Pass paginated transactions
                totalPages,
                page,
                limit,
                cartcount
            });
        } catch (error) {
            console.error("Error on wallet:", error);
            res.status(500).json({ success: false, message: "Server error on wallet. Try again later." });
        }
    };
    const razorpay = new Razorpay({
        key_id: 'rzp_test_JQ4XKaeQP0R8PZ',
        key_secret: 'Nw9O0gxxhJwU0yGeA7pBM0oU'
    });
    
let createRazorpayOrd =async(req,res)=>{
    const { amount } = req.body;

    const options = {
        amount: amount * 100, // amount in the smallest currency unit (paise)
        currency: "INR",
        receipt: "order_rcptid_11"
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json({ order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
const walletsave = async (user, amount) => {
    try {
        // Find the user by their ID
        const userData = await User.findById(user);
        let Wallet = await wallet.findOne({ user: user });
        if (!userData) {
            throw new Error('User not found');
        }
        if (!Wallet) {
            Wallet = new wallet({
                user: user.id,
                balance: 0 // Initialize balance to 0
            });
        }
       console.log('amount',amount)
        userData.Wallet += parseFloat(amount);
        Wallet.balance += parseFloat(amount);
       
      let usersaved=  await userData.save();
      console.log("usersaved", usersaved);
      let walletsaved=  await Wallet.save();
      console.log("walletsaved", walletsaved);
        return { success: true, message: 'Wallet balance updated successfully' };
    } catch (error) {
        console.error('Error updating wallet balance:', error);
        throw new Error('Failed to update wallet balance');
    }
};

 
let verifypayment = async (req, res) => {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', 'Nw9O0gxxhJwU0yGeA7pBM0oU')
                                    .update(body.toString())
                                    .digest('hex');

    if (expectedSignature === razorpay_signature) {
        
        await walletsave(req.session.user, amount);

        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'Invalid signature' });
    }
}

module.exports = {
    userProfile,
    edituser,
    changepassword,
    changenewpassword,
    addressmanagement,
    addaddress,
    seteditAddress,
    editAddress,
    deleteAddress,
    orderDetails,
    orderHistory,
    returnOrder,handleReturnRequest,
    cancelorder,
    loadwallet,
    createRazorpayOrd,
    verifypayment
};
