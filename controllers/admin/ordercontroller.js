const Order = require('../../models/orderSchema');
const users = require('../../models/userschema');
const product = require("../../models/productSchema");
let wallet=require('../../models/walletSchema')
let env = require("dotenv").config();

const listOrders = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = '', status: selectedStatus = '', sortBy = 'date' } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

    
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;

        let searchQuery = {};
        if (search) {
            searchQuery.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'userId.name': { $regex: search, $options: 'i' } },
            ];
        }

        let filter = { ...searchQuery };

        filter.status = { $ne: 'Failed' };

        if (selectedStatus && selectedStatus !== 'all') {
            filter.status = selectedStatus;
        }

        let sort = {};
        switch (sortBy) {
            case 'orderId':
                sort = { orderId: 1 };
                break;
            case 'customer':
                sort = { 'userId.name': 1 };
                break;
            case 'productName':
                sort = { 'orderItems.product.productName': 1 };
                break;
            case 'date':
                sort = { createdOn: -1 };
                break;
            default:
                sort = { createdOn: -1 };
        }

        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        const returnRequests = await Order.find({
  $or: [
    { status: 'Return Request' }, 
    { 'orderItems': { $elemMatch: { status: 'Return Request' } } } 
  ]
})
            .populate('userId', 'name email')
            .populate('orderItems.product');

        const orders = await Order.find(filter)
            .populate('userId', 'name email')
            .populate('address')
            .populate('orderItems.product')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);

        return res.render('admin/order', {
            orders,
            currentPage:'orders', 
            totalOrders,
            totalPages,
            returnRequests,
            search,
            page,
            selectedStatus,
            sortBy,
        });
    } catch (error) {
        console.error('Error in listOrders:', error);
        return res.status(500).send('Internal Server Error');
    }
};


const viewOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('orderId', orderId);
        const order = await Order.findOne({ orderId: orderId })
            .populate('userId', 'name email')
            .populate('address')
            .populate('orderItems.product');
        if (!order) {
            return res.status(404).send('Order not found');
        }

        return res.render('admin/orderDetails', { order, currentPage: 'orders' });
    } catch (error) {
        console.error('Error in viewOrder:', error);
        return res.status(500).send('Internal Server Error');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;

        console.log('body data', req.body);

        const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
        if (!allowedStatuses.includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status value.' });
        }


        const order = await Order.findOne({ orderId: orderId })
            .populate('orderItems.product')
            .populate('userId');
        if (!order) {
            console.log('order:', order);
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

      
        const previousStatus = order.status;

       
        order.status = newStatus;


        for (let i = 0; i < order.orderItems.length; i++) {
            const item = order.orderItems[i];
            if (item.status !== newStatus) {
                if (newStatus === 'Cancelled' && item.status !== 'Cancelled') {
                    const refundAmount = item.price * item.quantity;
                    order.finalAmount -= refundAmount;
                    await product.updateOne(
                        { _id: item.product },
                        { $inc: { quantity: item.quantity } }
                    );
                    await wallet.updateOne(
                        { user: order.userId },
                        {
                            $inc: { balance: refundAmount },
                            $push: {
                                transactions: {
                                    order: order._id,
                                    item: item._id,
                                    description: `Refund for cancelling item in order #${order.orderId}`,
                                    amount: refundAmount,
                                    date: new Date(),
                                    status: 'completed',
                                    type: 'credit',
                                },
                            },
                        },
                        { upsert: true }
                    );
                } else if (newStatus === 'Returned' && item.status !== 'Returned') {
                    const refundAmount = item.price * item.quantity;
                    
                    await product.updateOne(
                        { _id: item.product },
                        { $inc: { quantity: item.quantity } }
                    );
                    await wallet.updateOne(
                        { user: order.userId },
                        {
                            $inc: { balance: refundAmount },
                            $push: {
                                transactions: {
                                    order: order._id,
                                    item: item._id,
                                    description: `Refund for returning item in order #${order.orderId}`,
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
                item.status = newStatus; 
            }
        }

        await order.save();
        console.log('updated order:', order);

        return res.json({ success: true, order });
    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const returnOrder = async (req, res) => {
    try {
        let { orderId, returnReason } = req.body;
        let userId = req.session.user || req.body.userId;
     
        if (!orderId || !returnReason) {
            return res.status(400).json({ success: false, message: "Order ID and return reason are required." });
        }

        let order = await Order.findOne({ _id: orderId, userId: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        if (order.status.toLowerCase() !== 'delivered') {
            return res.status(400).json({ success: false, message: "Only delivered orders can be returned." });
        }

        order.status = 'Return Request';
        order.returnReason = returnReason;
        await order.save();
        
        if (order.orderItems && order.orderItems.length > 0) {
            for (const item of order.orderItems) {
                const { product: productId, quantity } = item;

           
              let updated = await product.updateOne({
                   product: productId},
               {$set:     { $inc: { quantity: quantity }} },
                   
                );
                  if(updated){
                console.log(`Updated stock for product ${productId} by ${quantity}`);  
                console.log(updated)
             } }
        }

        return res.json({ success: true, message: "Return request submitted successfully." });
    } catch (error) {
        console.error("Error returning order:", error);
        res.status(500).json({ success: false, message: "Server error while returning order. Try again later." });
    }
};
const handleReturnRequest = async (req, res) => {
    try {
        const { orderId, action } = req.body;

   
        if (!orderId || !action) {
            return res.status(400).json({ success: false, message: "Order ID and action are required." });
        }

     
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }


        if (order.status !== 'Return Request') {
            return res.status(400).json({ success: false, message: "No return request found for this order." });
        }


        if (action === 'approve') {
            order.status = 'Returned';
        } else if (action === 'reject') {
            order.status = 'Delivered';
        } else {
            return res.status(400).json({ success: false, message: "Invalid action." });
        }

       
        await order.save();


        if (order.orderItems && order.orderItems.length > 0) {
            for (const item of order.orderItems) {
                const { product: productId, quantity } = item;

       
             let updated =   await product.updateOne(
                    { _id: productId },
                    { $inc: { quantity: quantity } }
                  );
                if(updated){
                    console.log(`Updated stock for product ${productId} by ${quantity}`);  
                    console.log(updated)
                 
         
            const userId = order.userId;
            const refundAmount = order.finalAmount;

            walletbalence=await wallet.findOne({ user: userId });
            if (!walletbalence) {
                return res.status(404).json({ success: false, message: "Wallet not found." });
            }
            if (walletbalence.balance < refundAmount) {
                return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
            }
            await wallet.updateOne(
                { user: userId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            order: order._id,
                            description: `Refund for return of order #${order._id}`,
                            amount: refundAmount,
                            date: new Date(),
                            status: 'completed',
                            type: 'credit', 
                        },
                    },
                }
            );

       
            await users.updateOne(
                { _id: userId },
                { $inc: { Wallet: refundAmount } }
            );

            console.log(`Refunded ${refundAmount} to user ${userId}'s wallet.`);
        }
                 }
            }
        

        return res.json({ success: true, message: `Return request ${action}ed successfully.` });
    } catch (error) {
        console.error("Error handling return request:", error);
        res.status(500).json({ success: false, message: "Server error while handling return request. Try again later." });
    }
};

const singlehandleReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, action } = req.body;

        if (!orderId || !itemId || !action) {
            return res.status(400).json({ success: false, message: "Order ID, item ID, and action are required." });
        }

        const order = await Order.findById(orderId).populate('userId');
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

        let refundAmount;

        if (order.discount && order.discount > 0) {
            const totalOrderPrice = order.orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            
            const itemTotalPrice = item.price * item.quantity;
            const discountShare = (order.discount / totalOrderPrice) * itemTotalPrice;
            
            refundAmount = itemTotalPrice - discountShare;
        } else {
            refundAmount = item.price * item.quantity;
        }

        if (action === 'approve') {
            item.status = 'Returned';

            await product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            );

           await wallet.updateOne(
                { user: order.userId._id },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            order: order._id,
                            item: item._id,
                            description: `Refund for approved return in order #${order.orderId}`,
                            amount: refundAmount,
                            date: new Date(),
                            status: 'completed',
                            type: 'credit',
                        },
                    },
                },
                { upsert: true }
            );

            await users.updateOne(
                { _id: order.userId._id },
                { $inc: { Wallet: refundAmount } }
            );
        } else if (action === 'reject') {
            item.status = 'Delivered';
            refundAmount = 0; 
        } else {
            return res.status(400).json({ success: false, message: "Invalid action." });
        }

        await updateOrderStatusBasedOnItems(order);

        await order.save();

        return res.json({
            success: true,
            message: `Return request ${action}ed successfully for the item.`,
            refundAmount
        });
    } catch (error) {
        console.error("Error handling return request:", error);
        res.status(500).json({ success: false, message: "Server error while handling return request. Try again later." });
    }
};
const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;

        if (!orderId || !itemId || !status) {
            return res.status(400).json({ success: false, message: "Order ID, item ID, and status are required." });
        }

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value." });
        }

        const order = await Order.findById(orderId).populate('userId');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const item = order.orderItems.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found in the order." });
        }

       
        const previousStatus = item.status;

       
        if (status === 'Returned' && previousStatus !== 'Returned') {
            const refundAmount = item.price * item.quantity;
            
            await product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            );

          console.log(`Refund amount: ${refundAmount}`);
            await wallet.updateOne(
                { user: order.userId._id },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            order: order._id,
                            item: item._id,
                            description: `Refund for returned item in order #${order.orderId}`,
                            amount: refundAmount,
                            date: new Date(),
                            status: 'completed',
                            type: 'credit',
                        },
                    },
                },
                { upsert: true }
            );

            await users.updateOne(
                { _id: order.userId._id },
                { $inc: { Wallet: refundAmount } }
            );

           
        } 

        item.status = status;

        await updateOrderStatusBasedOnItems(order);

        await order.save();

        return res.json({ 
            success: true, 
            message: `Item status updated to ${status} successfully.`,
            refundAmount: status === 'Returned' ? item.price * item.quantity : 0
        });
    } catch (error) {
        console.error("Error updating item status:", error);
        res.status(500).json({ success: false, message: "Server error while updating item status." });
    }
};


const updateOrderStatusBasedOnItems = async (order) => {
    let hasReturnRequest = false;
    let allSameStatus = true;
    const firstStatus = order.orderItems[0].status;

    for (let i = 0; i < order.orderItems.length; i++) {
        if (order.orderItems[i].status === 'Return Request') {
            hasReturnRequest = true;
        }
        if (order.orderItems[i].status !== firstStatus) {
            allSameStatus = false;
        }
    }

    if (hasReturnRequest) {
        order.status = 'Return Request';
    } else if (allSameStatus) {
        order.status = firstStatus;
    }
};
module.exports = {
    listOrders,
    viewOrder,
    updateOrderStatus,
    returnOrder,
    handleReturnRequest,
    singlehandleReturnRequest,
    updateItemStatus
};
