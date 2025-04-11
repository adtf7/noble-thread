  const mongoose = require('mongoose');
  const Product = require('../../models/productSchema');
  const User = require('../../models/userschema');
  const Category = require('../../models/categorySchema');
  const Address = require('../../models/addressSchema');
  const Cart = require('../../models/cartSchema'); 
  const order = require('../../models/orderSchema');
  const Razorpay = require('razorpay');
  const crypto = require('crypto');
  let env = require('dotenv').config();
  let wallet=require('../../models/walletSchema')
  let coupon = require("../../models/couponSchema");
  const user = require('../../models/userschema');
  const Offer=require('../../models/offerSchema')

  const addToCart = async (req, res) => {
    try {
        let userId = req.session.user;
        if (!userId) {
            console.log("User not logged-in.");
            return res.redirect('/login');
        }

        const { productId, quantity } = req.body;
        console.log("Request Body:", req.body);

        if (!productId || !quantity) {
            return res.status(400).json({ success: false, message: "ProductId and quantity are required." });
        }

        // Fetch product and populate category
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            console.log("Product not found:", productId);
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        // Check product availability
        if (product.status.toLowerCase() !== 'available' || product.quantity < 1) {
            return res.status(400).json({ success: false, message: "Product is out of stock." });
        }
        if (product.quantity < quantity) {
            return res.status(400).json({ success: false, message: "Limited stock, please reduce your quantity." });
        }

        // Fetch offers
        const productOffer = await Offer.findById(product.offer);
        const categoryOffer = await Offer.findById(product.category.offer);

        // Determine the largest offer
        let largestOffer = 0;

        if (productOffer) {
            largestOffer = productOffer.discountPercentage;
        }

        if (categoryOffer && categoryOffer.discountPercentage > largestOffer) {
            largestOffer = categoryOffer.discountPercentage;
        }

        // Calculate discounted price
        let discountedPrice = product.salePrice;

        if (largestOffer > 0) {
            discountedPrice = product.salePrice * (1 - largestOffer / 100);
        }

        console.log('Product:', product);
        console.log('Discounted Price:', discountedPrice);
        req.session.discountedPrice = discountedPrice;
        // Validate quantity
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({ success: false, message: "Quantity must be at least 1." });
        }
        if (qty > 5) {
            return res.status(400).json({ success: false, message: "You cannot add more than 5 products at a time." });
        }

        // Calculate total price
        const totalPrice = discountedPrice * qty;
        console.log(`Price: ${discountedPrice}, Quantity: ${qty}, Total: ${totalPrice}`);

        // Convert userId to ObjectId
        const userObjId = new mongoose.Types.ObjectId(userId);

        // Find or create cart
        let cart = await Cart.findOne({ userId: userObjId });
        console.log("Existing cart:", cart);

        if (cart) {
            // Initialize items array if it doesn't exist
            if (!cart.items) {
                cart.items = [];
            }

            // Check if the product already exists in the cart
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
            console.log("Item index:", itemIndex);

            if (itemIndex > -1) {
                // Update quantity and total price for existing item
                cart.items[itemIndex].quantity += qty;

                if (cart.items[itemIndex].quantity > 5) {
                    return res.status(400).json({ success: false, message: "Total quantity for this product cannot exceed 5." });
                }

                cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * discountedPrice;
            } else {
                // Add new item to the cart
                cart.items.push({
                    productId,
                    quantity: qty,
                    price: discountedPrice,
                    totalPrice,
                });
            }

            // Save the updated cart
            cart = await cart.save();
            console.log("Cart after update:", cart);
        } else {
            // Create a new cart
            cart = new Cart({
                userId: userObjId,
                items: [{
                    productId,
                    quantity: qty,
                    price: discountedPrice,
                    totalPrice,
                }]
            });

            // Save the new cart
            cart = await cart.save();
            console.log("New cart created:", cart);
        }

        // Return success response
        return res.json({ success: true, message: "Product added to cart successfully!", cart });

    } catch (error) {
        console.error("Error adding product to cart:", error);
        return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
    }
  };

  let loadcart = async (req, res) => {
    try {
      if (!req.session.user) {
        return res.redirect('/login');
      }
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
    
      const userdata = await User.findOne({ _id: userId });
      

      let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
                          .populate('items.productId');
      
      if (!cart) {
        cart = { items: [] };
      }
      
      res.render('user/shopping-cart', { user: userdata, currentPage: 'shop', cart: cart,cartcount });
    } catch (error) {
      console.error('Cart not loading:', error.message);
      res.status(500).send('Internal Server Error');
    }
  };


  let updateCartItem = async (req, res) => {
    try {
      const userId = req.session.user;
      if (!userId) {
        return res.redirect('/login');
      }
      
      const { productId, quantity } = req.body;
      
      if (!productId || quantity === undefined) {
        return res.status(400).json({ success: false, message: "ProductId and quantity are required." });
      }

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: "Quantity must be at least 1." });
      }
      if (qty > 5) {
        return res.status(400).json({ success: false, message: "You cannot add more than 5 products at a time." });
      }
      

      let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      if (!cart) {
        return res.status(404).json({ success: false, message: "Cart not found." });
      }

      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex === -1) {
        return res.status(404).json({ success: false, message: "Product not found in cart." });
      }
      

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }
      const price = Number(product.salePrice);
      if (isNaN(price)) {
        return res.status(400).json({ success: false, message: "Product price is invalid or not defined." });
      }
      

      cart.items[itemIndex].quantity = qty;
      cart.items[itemIndex].totalPrice = price * qty;
      
      cart = await cart.save();
      return res.json({ success: true, message: "Cart updated successfully.", cart });
      
    } catch (error) {
      console.error("Error updating cart item:", error);
      return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
    }
  };


  let removeCartItem = async (req, res) => {
    try {
      const userId = req.session.user;
      if (!userId) {
        return res.redirect('/login');
      }
      
      const { productId } = req.body;
      console.log( 'deleteid',productId)
      if (!productId) {
        return res.status(400).json({ success: false, message: "ProductId is required." });
      }
      
      // Find user's cart and the cart item
      let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      if (!cart) {
        return res.status(404).json({ success: false, message: "Cart not found." });
      }
      
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex === -1) {
        return res.status(404).json({ success: false, message: "Product not found in cart." });
      }
      
      // Remove the item from the cart
      cart.items.splice(itemIndex, 1);
      cart = await cart.save();
      
      return res.json({ success: true, message: "Product removed from cart successfully.", cart });
      
    } catch (error) {
      console.error("Error removing cart item:", error);
      return res.status(500).json({ success: false, message: "Internal server error. Please try again later." });
    }
  };


  const loadcheckout = async (req, res) => {
    try {
      if (!req.session.user) {
        return res.render('login', { message: 'You can purchase after login' });
      }

      const userId = req.session.user;
      const userdata = await User.findOne({ _id: userId });
      if (!userdata) {
        return res.status(404).render('error', { message: 'User not found.' });
      }

      const addresses = await Address.find({ userid: userId });

      // Get the coupons and filter out those already redeemed by the user
      const allCoupons = await coupon.find({ isList: true });
      // Filter coupons where the current user's ID is not in their redeemedUser array
      const coupons = allCoupons.filter(coupon => 
        !userdata.redeemedUser.some(redeemedId => redeemedId.toString() === coupon._id.toString())
      );

      const cart = await Cart.findOne({
        userId: new mongoose.Types.ObjectId(userId),
      }).populate("items.productId");
      const cartItems = cart && cart.items ? cart.items : [];

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

      const subtotal = cartItems.reduce((sum, item) => {
        const itemTotal = item.totalPrice ? Number(item.totalPrice) : (item.price && item.quantity ? Number(item.price) * Number(item.quantity) : 0);
        return sum + itemTotal;
      }, 0);

      let totalprice = 0;
      const { discount = 0, taxes = 0, shipping = 0 } = req.session;

      // Calculate totalprice using item.totalPrice with safety check
      cartItems.forEach((item) => {
        const itemTotal = item.totalPrice ? Number(item.totalPrice) : (item.price && item.quantity ? Number(item.price) * Number(item.quantity) : 0);
        totalprice += itemTotal;
      });

      const finalTotal = subtotal - discount + taxes + shipping;

      console.log('Debug values:', {
        cartItemsLength: cartItems.length,
        cartItems: cartItems.map(item => ({
          price: item.price,
          quantity: item.quantity,
          totalPrice: item.totalPrice 
        })),
        subtotal,
        discount,
        taxes,
        shipping,
        finalTotal,
        totalprice
      });

      return res.render('user/checkout', { 
        user: userdata, 
        currentPage: 'shop', 
        addresses, 
        cartItems, 
        subtotal, 
        discount, 
        taxes, 
        shipping,
        finalTotal,
        coupons, // This now contains only coupons not redeemed by the user
        totalprice,
        cartcount 
      });

    } catch (error) {
      console.error('Checkout not loading:', error.message);
      res.status(500).render('error', { message: 'Internal Server Error' });
    }
  };


  const calculatePriceDetails = async (userId, couponId = null) => {
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
                          .populate('items.productId');
    const cartItems = cart ? cart.items : [];

    let subtotal = 0;
    cartItems.forEach(item => {
        subtotal += item.totalPrice || (item.price * item.quantity); // Fallback if totalPrice is undefined
    });

    let discount = 0;
    if (couponId) {
        const coupons = await coupon.findById(couponId); // Fixed typo: "coupons" to "coupon"
        if (coupons) {
            discount = (coupons.offerPrice / 100) * subtotal;
        }
    }

    console.log('discount:', discount);
    const taxes = 0;
    const shipping = 0;
    const finalTotal = subtotal - discount + taxes + shipping;

    return {
        subtotal,
        discount,
        taxes,
        shipping,
        finalTotal,
    };
  };
  const razorpay = new Razorpay({
    key_id: 'rzp_test_JQ4XKaeQP0R8PZ' ,// Use environment variable
    key_secret: 'Nw9O0gxxhJwU0yGeA7pBM0oU', // Use environment variable
  });

  // Create a Razorpay order
  const createRazorpayOrder = async (req, res) => {
    try {
      const { amount } = req.body;
      console.log('razorpay amount',amount)
      Number(amount)
      console.log('Received amount:', amount);

      // Validate amount
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount. Please provide a positive number.' });
      }

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Ensure integer
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1,
      });
      

      if (!razorpayOrder) {
        console.error('Failed to create Razorpay order');
        return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.' });
      }

      // Send successful response
      res.status(200).json({ success: true, order: razorpayOrder });
    } catch (error) {
      console.error('Razorpay API Error:', error.message || error);
      res.status(500).json({ success: false, message: 'Failed to create Razorpay order.' });
    }
  };


  const placeOrder = async (req, res) => {
    try {
      const userId = req.session.user;
      if (!userId) {
        return res.redirect('/login');
      }

      // Validate cart exists and has items
      const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty.' });
      }

      // Calculate subtotal with proper number handling
      let subtotal = 0;
      for (const item of cart.items) {
        if (!item.productId || !item.quantity || !item.totalPrice) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid cart item data' 
          });
        }
        subtotal += Number(item.totalPrice.toFixed(2));
      }
      
      // Ensure finalTotal is a valid number
      const finalTotal = Number(req.session.finalTotal || subtotal).toFixed(2);
      if (isNaN(finalTotal)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid total amount' 
        });
      }
      
      const orderItems = [];
      const productsToRestore = [];
      
      // Validate products and quantities
      for (const item of cart.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({ 
            success: false, 
            message: `Product not found: ${item.productId}` 
          });
        }
        
        // Ensure quantity is a valid number
        const quantity = Number(item.quantity);
        if (isNaN(quantity) || quantity <= 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid quantity for ${product.name}` 
          });
        }
        
        if (product.stock < quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
          });
        }
        
        orderItems.push({
          product: item.productId,
          quantity: quantity,
          price: Number(item.price.toFixed(2)),
          totalPrice: Number(item.totalPrice.toFixed(2))
        });

        productsToRestore.push({
          productId: item.productId,
          quantity: quantity
        });
      }

      // Calculate discount safely
      const discount = Math.max(0, Number((subtotal - finalTotal).toFixed(2)));
      if (isNaN(discount)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid discount calculation' 
        });
      }

      // Validate address
      let addressId = req.body.address;
      if (!addressId) {
        const userAddress = await Address.findOne({ userid: userId });
        if (!userAddress) {
          return res.status(400).json({ 
            success: false, 
            message: 'No address found. Please add an address.' 
          });
        }
        addressId = userAddress._id;
      }

      // Validate payment method
      const paymentMethod = req.body.paymentMethod;
      const validPaymentMethods = ['COD', 'Razorpay', 'Wallet'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid payment method' 
        });
      }

      // Create order (using lowercase 'order' as per your model)
      const newOrder = new order({
        userId,
        orderItems,
        totalAmount: subtotal,
        discount,
        finalAmount: finalTotal,
        address: addressId,
        invoiceDate: new Date(),
        shoppingMethod: paymentMethod,
        status: 'Pending',
        createdOn: new Date(),
        couponStatus: !!req.session.coupon,
      });

      // Handle wallet payment (using lowercase 'wallet' as per your model)
      if (paymentMethod === 'Wallet') {
        const userWallet = await wallet.findOne({ user: userId });
        if (!userWallet) {
          return res.status(400).json({ 
            success: false, 
            message: "Wallet not found for the user" 
          });
        }

        if (userWallet.balance < finalTotal) {
          return res.status(400).json({ 
            success: false, 
            message: 'Insufficient wallet balance' 
          });
        }
        
        await wallet.updateOne(
          { user: userId },
          { 
            $inc: { balance: -finalTotal },
            $push: {
              transactions: {
                order: newOrder._id, 
                description: `Payment for order #${newOrder._id}`,
                amount: finalTotal, 
                date: new Date(),
                status: 'completed',
                type: 'debit', 
              },
            },
          }
        );
      }

      // Handle coupon if exists
      if (req.session.coupon) {
        await User.findByIdAndUpdate(
          userId, 
          { $push: { redeemedUser: req.session.coupon } },
          { new: true }
        );
        
        // Clear coupon from session after use
        delete req.session.coupon;
      }

      // Save order
      await newOrder.save();
      
      // Update product stock
      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { quantity: -item.quantity } }
        );
      }

      // Clear cart
      await Cart.updateOne(
        { userId },
        { $set: { items: [] } }
      );

      // Handle response based on payment method
      if (paymentMethod === 'Razorpay') {
        const razorpayOrder = await razorpay.orders.create({
          amount: Math.round(finalTotal * 100), // Razorpay expects amount in paise
          currency: 'INR',
          receipt: `receipt_${newOrder._id}`,
          payment_capture: 1,
        });
        
        return res.status(200).json({ 
          success: true, 
          order: newOrder, 
          razorpayOrder 
        });
      }

      // For COD and Wallet
      return res.status(200).json({ 
        success: true, 
        order: newOrder 
      });

    } catch (error) {
      console.error('Error placing order:', error);
      
   
      for (const product of productsToRestore) {
        await Product.updateOne(
          { _id: product.productId },
          { $inc: { quantity: product.quantity } }
           

        );
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error. Please try again later.',
        error: error.message 
      });
    }
  };

  // Handle Razorpay payment success
  const handleRazorpayPaymentSuccess = async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
  console.log(' razorpay_payment_id', razorpay_payment_id)
  console.log('razorpay_order_id', razorpay_order_id)
  console.log(' razorpay_signature,',  razorpay_signature,)
  console.log('orderId', orderId)
      const generatedSignature = crypto
        .createHmac('sha256', 'Nw9O0gxxhJwU0yGeA7pBM0oU')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
      }

      const updatedOrder = await order.findByIdAndUpdate(
        orderId,
        { status: 'Paid', paymentId: razorpay_payment_id },
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(400).json({ success: false, message: 'Order not found.' });
      }

      return res.status(200).json({ success: true, order: updatedOrder });
    } catch (error) {
      console.error('Error handling Razorpay payment success:', error);
      res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
    }
  };

  // Render order success page
  const orderSuccess = async (req, res) => {
    try {
      res.render('user/order-success', { order: '' });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  };

  let handlesuccess = async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

      console.log("razorpay_payment_id", razorpay_payment_id);
      console.log("razorpay_order_id", razorpay_order_id);
      console.log('razorpay_signature', razorpay_signature);
      console.log("orderId", orderId);

      // Validate input
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
      }

      // Verify the payment signature
      const generatedSignature = crypto
        .createHmac('sha256', 'Nw9O0gxxhJwU0yGeA7pBM0oU') // Use environment variable for key secret
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
      }

      // Find the order using the Razorpay order ID
      const updatedOrder = await order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id }, // Query by Razorpay order ID
        { status: 'Pending', paymentId: razorpay_payment_id }, // Update status and payment ID
        { new: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Return success response
      return res.status(200).json({ success: true, order: updatedOrder });
    } catch (error) {
      console.error('Error handling payment success:', error);
      return res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
    }
  };

  const getUpdatedPriceDetails = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated. Please log in.' });
        }

        const userId = req.session.user;
        const { couponId } = req.body;

        console.log("Received couponId:", couponId); // Debug log

        // If couponId is falsy (null, undefined, or empty string), treat it as removing the coupon
        const effectiveCouponId = couponId || null;

        // Calculate price details with or without a coupon
        const { subtotal, discount, taxes, shipping, finalTotal } = await calculatePriceDetails(userId, effectiveCouponId);

        // Update session variables
        req.session.coupon = effectiveCouponId;
        req.session.subtotal = subtotal;
        req.session.discount = discount;
        req.session.taxes = taxes;
        req.session.shipping = shipping;
        req.session.finalTotal = finalTotal;

        // If removing the coupon, ensure discount is reset
        if (!effectiveCouponId) {
            req.session.discount = 0;
        }

        console.log("Price details:", { subtotal, discount, taxes, shipping, finalTotal }); // Debug log

        // Send response
        res.status(200).json({
            success: true,
            data: {
                subtotal,
                discount,
                taxes,
                shipping,
                finalTotal,
            },
        });
    } catch (error) {
        console.error("Error fetching updated price details:", error.message);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
  };
  module.exports = {
    addToCart,
    loadcart,
    updateCartItem,
    removeCartItem,
    loadcheckout,
    placeorder:placeOrder,
    orderSuccess,
    handleRazorpayPaymentSuccess,
    createRazorpayOrder          ,
    handlesuccess        ,
    getUpdatedPriceDetails};