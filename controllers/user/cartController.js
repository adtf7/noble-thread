const mongoose = require('mongoose');
const Product = require('../../models/productSchema');
const User = require('../../models/userschema');
const Category = require('../../models/categorySchema');
const Address = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponSchema');
const Offer = require('../../models/offerSchema');
const axios = require('axios');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_JQ4XKaeQP0R8PZ',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'Nw9O0gxxhJwU0yGeA7pBM0oU',
});

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ success: false, message: 'ProductId and quantity are required.' });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product || product.status.toLowerCase() !== 'available' || product.quantity < 1) {
      return res.status(400).json({ success: false, message: 'Product is unavailable or out of stock.' });
    }
    if (product.quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Limited stock, please reduce your quantity.' });
    }

    const productOffer = await Offer.findById(product.offer);
    const categoryOffer = await Offer.findById(product.category.offer);
    let largestOffer = 0;
    if (productOffer) largestOffer = productOffer.discountPercentage;
    if (categoryOffer && categoryOffer.discountPercentage > largestOffer) largestOffer = categoryOffer.discountPercentage;

    const discountedPrice = largestOffer > 0 ? product.salePrice * (1 - largestOffer / 100) : product.salePrice;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 5) {
      return res.status(400).json({ success: false, message: 'Quantity must be between 1 and 5.' });
    }

    const totalPrice = discountedPrice * qty;
    let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (cart) {
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += qty;
        if (cart.items[itemIndex].quantity > 5) {
          return res.status(400).json({ success: false, message: 'Total quantity cannot exceed 5.' });
        }
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * discountedPrice;
      } else {
        cart.items.push({ productId, quantity: qty, price: discountedPrice, totalPrice });
      }
      cart = await cart.save();
    } else {
      cart = new Cart({
        userId: new mongoose.Types.ObjectId(userId),
        items: [{ productId, quantity: qty, price: discountedPrice, totalPrice }],
      });
      cart = await cart.save();
    }

    return res.json({ success: true, message: 'Product added to cart!', cart });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const loadcart = async (req, res) => {
  try {
    const userId = req.session.user;
    const userdata = await User.findOne({ _id: userId });
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      { $group: { _id: '$userId', totalItems: { $sum: 1 }, totalQuantity: { $sum: '$items.quantity' } } },
    ]);

    let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate({
      path: 'items.productId',
      populate: { path: 'category', model: 'Category' },
    });

    if (!cart) cart = { items: [] };
    res.render('user/shopping-cart', { user: userdata, currentPage: 'shop', cart, cartcount });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.status(500).render('error', { message: 'Internal Server Error' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;
    if (!productId || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'ProductId and quantity are required.' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 5) {
      return res.status(400).json({ success: false, message: 'Quantity must be between 1 and 5.' });
    }

    let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Product not found in cart.' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    cart.items[itemIndex].quantity = qty;
    cart.items[itemIndex].totalPrice = product.salePrice * qty;
    cart = await cart.save();

    return res.json({ success: true, message: 'Cart updated successfully.', cart });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'ProductId is required.' });

    let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found.' });

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Product not found in cart.' });

    cart.items.splice(itemIndex, 1);
    cart = await cart.save();
    return res.json({ success: true, message: 'Product removed from cart.', cart });
  } catch (error) {
    console.error('Error removing cart item:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const loadcheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const userdata = await User.findOne({ _id: userId });
    if (!userdata) return res.status(404).render('error', { message: 'User not found.' });

    const addresses = await Address.find({ userid: userId });
    const allCoupons = await Coupon.find({ isList: true });
    const coupons = allCoupons.filter(coupon =>
      !userdata.redeemedUser.some(redeemedId => redeemedId.toString() === coupon._id.toString())
    );

    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    const cartItems = cart && cart.items ? cart.items : [];

    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      { $group: { _id: '$userId', totalItems: { $sum: 1 }, totalQuantity: { $sum: '$items.quantity' } } },
    ]);

    const subtotal = cartItems.reduce((sum, item) => {
      const itemTotal = item.totalPrice || (item.price && item.quantity ? item.price * item.quantity : 0);
      return sum + Number(itemTotal);
    }, 0);

      const selectedCouponId = req.session.coupon || null;

    const {
      discount = 0,
      taxes = 0,
      shipping = 0,
      appliedCoupon = null
    } = await calculatePriceDetails(userId, selectedCouponId);

    const finalTotal = subtotal - discount + taxes + shipping;

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
      coupons,
      cartcount,
      appliedCoupon,
      selectedCouponId 
    });
  } catch (error) {
    console.error('Error loading checkout:', error);
    res.status(500).render('error', { message: 'Internal Server Error' });
  }
};

const calculatePriceDetails = async (userId, couponId = null) => {
  try {
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    if (!cart || !cart.items) {
      return { subtotal: 0, discount: 0, taxes: 0, shipping: 0, finalTotal: 0, orderItems: [] };
    }

    let subtotal = 0;
    const orderItems = [];
    cart.items.forEach(item => {
      const total = item.totalPrice || item.price * item.quantity;
      subtotal += total;
      orderItems.push({
        productId: item.productId?._id || null,
        quantity: item.quantity || 0,
        price: item.price || 0,
        totalPrice: total || 0,
      });
    });

    let discount = 0;
    let appliedCoupon = null;
    if (couponId) {
      const couponData = await Coupon.findById(couponId);
      if (couponData && couponData.isList && subtotal >= couponData.minimumPrice) {
       
        discount = (couponData.offerPrice / 100) * subtotal;
        if (discount > couponData.maxDiscount) {
          discount = couponData.maxDiscount;
        }
        appliedCoupon = couponData;
      }
    }

    const taxes = 0;
    const shipping = 0;
    const finalTotal = subtotal - discount + taxes + shipping;

    return { subtotal, discount, taxes, shipping, finalTotal, orderItems, appliedCoupon };
  } catch (error) {
    console.error('Error calculating price details:', error);
    throw new Error('Failed to calculate price details.');
  }
};

const saveFailedOrder = async (userId, orderDetails) => {
  try {
    let { address, orderItems, subtotal, discount, finalTotal, paymentMethod, failureReason, couponId, razorpayOrderId, razorpayPaymentId, requestId } = orderDetails;
  if(paymentMethod=='Wallet'){
    return { success: true, message: 'Insufficient wallet balance.' }
  }
  console.log('paymentMethod=',paymentMethod)
    const allowedReasons = [
      'Payment was cancelled by user',
      'Something went wrong during payment'
    ];
    if (!allowedReasons.includes(failureReason)) {
      failureReason = 'Something went wrong during payment';
    }

    console.log('saveFailedOrder received:', { userId, address, orderItems, subtotal, discount, finalTotal, paymentMethod, failureReason, couponId, razorpayOrderId, razorpayPaymentId, requestId });

    if (!userId) throw new Error('User ID is required.');
    if (!paymentMethod) throw new Error('Payment method is required.');
    if (!failureReason) throw new Error('Failure reason is required.');
    if (!requestId) throw new Error('Request ID is required for deduplication.');

    const query = {
      userId,
      status: 'Failed',
      requestId,
    };
    if (paymentMethod === 'Razorpay' && razorpayOrderId) query.razorpayOrderId = razorpayOrderId;
    const existing = await Order.findOne(query);
    if (existing) {
      console.log('Duplicate failed order detected:', { orderId: existing._id, razorpayOrderId, requestId });
      return { success: true, message: 'Duplicate failed order not saved.', orderId: existing._id };
    }

    const validatedOrderItems = Array.isArray(orderItems) && orderItems.length > 0
      ? orderItems.filter(item => item.productId && item.quantity > 0 && item.price >= 0 && item.totalPrice >= 0)
      : [];

    if (validatedOrderItems.length === 0) {
      console.log('Not saving failed order: No valid order items.');
      return { success: false, message: 'No valid order items to save.' };
    }

    const newOrder = new Order({
      userId,
      orderItems: validatedOrderItems.map(item => ({
        product: item.productId || null,
        quantity: item.quantity || 0,
        price: item.price || 0,
        status: 'Failed',
      })),
      totalAmount: subtotal || 0,
      discount: discount || 0,
      finalAmount: finalTotal || 0,
      address: address || null,
      invoiceDate: new Date(),
      shoppingMethod: paymentMethod || 'Unknown',
      status: 'Failed',
      createdOn: new Date(),
      couponStatus: !!couponId,
      failureReason: failureReason || 'Unknown error',
      razorpayOrderId: razorpayOrderId || null,
      razorpayPaymentId: razorpayPaymentId || null,
      requestId,
    });

    let saveorder=await newOrder.save();
    console.log('saveorder',saveorder)
    console.log('Failed order saved:', newOrder._id);
    return { success: true, message: 'Failed order saved successfully.', orderId: newOrder._id };
  } catch (error) {
    console.error('Error saving failed order:', error);
    return { success: false, message: error.message || 'Failed to save failed order.' };
  }
};

const saveFailedOrderRoute = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    const { address, orderItems, subtotal, discount, finalTotal, paymentMethod, failureReason, couponId, razorpayOrderId, razorpayPaymentId, requestId } = req.body;
    if(paymentMethod==='Wallet'){
         return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });

    }
    console.log('paymentMethod=',paymentMethod)
    console.log('saveFailedOrderRoute received:', {
      userId,
      address,
      orderItems,
      subtotal,
      discount,
      finalTotal,
      paymentMethod,
      failureReason,
      couponId,
      razorpayOrderId,
      razorpayPaymentId,
      requestId,
    });

    const result = await saveFailedOrder(userId, {
      address,
      orderItems,
      subtotal,
      discount,
      finalTotal,
      paymentMethod,
      failureReason: failureReason || 'Unknown error',
      couponId,
      razorpayOrderId,
      razorpayPaymentId,
      requestId,
    });

  
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error in saveFailedOrder route:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const createRazorpayOrder = async (req, res) => {
    const userId = req.session.user;
  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to place an order.' });
    }

    const { amount, couponId, requestId } = req.body;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required.' });
    }

    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    if (!cart || !cart.items || cart.items.length === 0) {
      let resA = await saveFailedOrder(userId, {
        address: null,
        orderItems: [],
        subtotal: 0,
        discount: 0,
        finalTotal: amount / 100 || 0,
        paymentMethod: 'Razorpay',
        failureReason: 'Cart is empty.',
        couponId,
        requestId,
      });
      if (resA) {
        console.log('resA');
      }
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const { subtotal, discount, taxes, shipping, finalTotal, orderItems } = await calculatePriceDetails(userId, couponId);
    if (Math.abs(finalTotal * 100 - amount) > 1) {
      const msg = `Amount mismatch: expected ${finalTotal}, received ${amount / 100}`;
      console.log('createRazorpayOrder amount mismatch:', { finalTotal, amount: amount / 100 });
      let resB = await saveFailedOrder(userId, {
        address: null,
        orderItems,
        subtotal,
        discount,
        finalTotal,
        paymentMethod: 'Razorpay',
        failureReason: msg,
        couponId,
        requestId,
      });
      if (resB) {
        console.log('resB');
      }
      return res.status(400).json({ success: false, message: msg });
    }

    const receipt = `order_${Date.now()}`.slice(0, 40);

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt,
        payment_capture: 1,
      });
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      let resD = await saveFailedOrder(userId, {
        address: null,
        orderItems,
        subtotal,
        discount,
        finalTotal,
        paymentMethod: 'Razorpay',
        failureReason: `Failed to create Razorpay order: ${error.message}`,
        couponId,
        requestId,
      });
      if (resD) {
        console.log('resD');
      }
      return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.', error: error.message });
    }

    if (!razorpayOrder.id || !razorpayOrder.amount) {
      let resC = await saveFailedOrder(userId, {
        address: null,
        orderItems,
        subtotal,
        discount,
        finalTotal,
        paymentMethod: 'Razorpay',
        failureReason: 'Invalid Razorpay order response',
        couponId,
        requestId,
      });
      if (resC) {
        console.log('resc');
      }
      throw new Error('Invalid Razorpay order response');
    }

    return res.status(200).json({
      success: true,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID || 'rzp_test_JQ4XKaeQP0R8PZ',
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    const orderItems = cart && cart.items ? cart.items.map(item => ({
      productId: item.productId?._id || null,
      quantity: item.quantity || 0,
      price: item.price || 0,
      totalPrice: item.totalPrice || 0,
    })) : [];
    let resD = await saveFailedOrder(userId, {
      address: null,
      orderItems,
      subtotal: 0,
      discount: 0,
      finalTotal: req.body.amount / 100 || 0,
      paymentMethod: 'Razorpay',
      failureReason: error.message || 'Internal server error.',
      couponId: req.body.couponId,
      requestId: req.body.requestId,
    });
    if (resD) {
      console.log('resD');
    }
    return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.', error: error.message });
  }
};

const handleRazorpayPaymentSuccess = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, address, paymentMethod, couponId, totalPrice, requestId } = req.body;
    const userId = req.session.user;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !address || !paymentMethod || !totalPrice || !requestId) {
      console.log('Razorpay Payment: FAILED (Missing payment details)');
      const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
      const orderItems = cart && cart.items ? cart.items.map(item => ({
        productId: item.productId?._id || null,
        quantity: item.quantity || 0,
        price: item.price || 0,
        totalPrice: item.totalPrice || 0,
      })) : [];
   let res2=   await saveFailedOrder(userId, {
        address,
        orderItems,
        subtotal: 0,
        discount: 0,
        finalTotal: totalPrice || 0,
        paymentMethod: 'Razorpay',
        failureReason: 'Missing required payment details.',
        couponId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res2]', { input: { address, orderItems, subtotal: 0, discount: 0, finalTotal: totalPrice || 0, paymentMethod: 'Razorpay', failureReason: 'Missing required payment details.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res2 });
      if(res2){
        console.log('res2')
      }
      return res.status(400).json({ success: false, message: 'Missing required payment details.', orderId: null });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'Nw9O0gxxhJwU0yGeA7pBM0oU')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.log('Razorpay Payment: FAILED (Invalid signature)');
      const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
      const orderItems = cart && cart.items ? cart.items.map(item => ({
        productId: item.productId?._id || null,
        quantity: item.quantity || 0,
        price: item.price || 0,
        totalPrice: item.totalPrice || 0,
      })) : [];
     let res3= await saveFailedOrder(userId, {
        address,
        orderItems,
        subtotal: 0,
        discount: 0,
        finalTotal: totalPrice || 0,
        paymentMethod: 'Razorpay',
        failureReason: 'Invalid payment signature.',
        couponId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res3]', { input: { address, orderItems, subtotal: 0, discount: 0, finalTotal: totalPrice || 0, paymentMethod: 'Razorpay', failureReason: 'Invalid payment signature.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res3 });
      if(res3){
        console.log('res3')
      }
      return res.status(400).json({ success: false, message: 'Invalid payment signature.', orderId: null });
    }

    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    if (!cart || !cart.items || cart.items.length === 0) {
      console.log('Razorpay Payment: FAILED (Cart is empty)');
     let res4= await saveFailedOrder(userId, {
        address,
        orderItems: [],
        subtotal: 0,
        discount: 0,
        finalTotal: totalPrice || 0,
        paymentMethod: 'Razorpay',
        failureReason: 'Cart is empty.',
        couponId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res4]', { input: { address, orderItems: [], subtotal: 0, discount: 0, finalTotal: totalPrice || 0, paymentMethod: 'Razorpay', failureReason: 'Cart is empty.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res4 });
      if(res4){
        console.log('res4')
      }
      return res.status(400).json({ success: false, message: 'Cart is empty.', orderId: null });
    }

    const addressExists = await Address.findOne({ _id: address, userid: userId });
    if (!addressExists) {
      console.log('Razorpay Payment: FAILED (Invalid address)');
      const orderItems = cart.items.map(item => ({
        productId: item.productId?._id || null,
        quantity: item.quantity || 0,
        price: item.price || 0,
        totalPrice: item.totalPrice || 0,
      }));
    let res5=  await saveFailedOrder(userId, {
        address,
        orderItems,
        subtotal: 0,
        discount: 0,
        finalTotal: totalPrice || 0,
        paymentMethod: 'Razorpay',
        failureReason: 'Invalid address selected.',
        couponId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res5]', { input: { address, orderItems, subtotal: 0, discount: 0, finalTotal: totalPrice || 0, paymentMethod: 'Razorpay', failureReason: 'Invalid address selected.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res5 });
      if(res5){
        console.log('res5')
      }
      return res.status(400).json({ success: false, message: 'Invalid address selected.', orderId: null });
    }

    const { subtotal, discount, taxes, shipping, finalTotal, orderItems } = await calculatePriceDetails(userId, couponId);
    if (Math.abs(finalTotal - totalPrice) > 0.01) {
      const msg = `Amount mismatch: expected ${finalTotal}, received ${totalPrice}`;
      console.log('Razorpay Payment: FAILED (Amount mismatch)', { finalTotal, totalPrice });
    let res6=  await saveFailedOrder(userId, {
        address,
        orderItems,
        subtotal,
        discount,
        finalTotal,
        paymentMethod: 'Razorpay',
        failureReason: msg,
        couponId,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res6]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: msg, couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res6 });
      if(res6){
        console.log('res6')
      }
      return res.status(400).json({ success: false, message: msg, orderId: null });
    }

    const productsToRestore = [];
    for (const item of cart.items) {
      if (!item.productId || !item.quantity || !item.totalPrice) {
      let res7=  await saveFailedOrder(userId, {
          address,
          orderItems,
          subtotal,
          discount,
          finalTotal,
          paymentMethod: 'Razorpay',
          failureReason: 'Invalid cart item data.',
          couponId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          requestId,
        });
        console.log('DEBUG saveFailedOrder [res7]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: 'Invalid cart item data.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res7 });
        if(res7){
          console.log('res7')
        }
        return res.status(400).json({ success: false, message: 'Invalid cart item data.', orderId: null });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
      let res8=  await saveFailedOrder(userId, {
          address,
          orderItems,
          subtotal,
          discount,
          finalTotal,
          paymentMethod: 'Razorpay',
          failureReason: `Product not found: ${item.productId}`,
          couponId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          requestId,
        });
        console.log('DEBUG saveFailedOrder [res8]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: `Product not found: ${item.productId}`, couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res8 });
        if(res8){
        console.log('res8')
      }
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}`, orderId: null });
      }

      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
      let res9=  await saveFailedOrder(userId, {
          address,
          orderItems,
          subtotal,
          discount,
          finalTotal,
          paymentMethod: 'Razorpay',
          failureReason: `Invalid quantity for ${product.name}`,
          couponId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          requestId,
        });
        console.log('DEBUG saveFailedOrder [res9]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: `Invalid quantity for ${product.name}`, couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res9 });
        if(res9){
        console.log('res9')
        }
        return res.status(400).json({ success: false, message: `Invalid quantity for ${product.name}`, orderId: null });
      }
      if (product.quantity < quantity) {
      let res10=  await saveFailedOrder(userId, {
          address,
          orderItems,
          subtotal,
          discount,
          finalTotal,
          paymentMethod: 'Razorpay',
          failureReason: `Insufficient stock for ${product.name}.`,
          couponId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          requestId,
        });
        console.log('DEBUG saveFailedOrder [res10]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: `Insufficient stock for ${product.name}.`, couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res10 });
        if(res10){
          console.log('res10')
        }
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.`, orderId: null });
      }

      productsToRestore.push({ productId: item.productId, quantity });
    }

    const newOrder = new Order({
      userId,
      orderItems: orderItems.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
        status: 'Pending',
      })),
      totalAmount: subtotal,
      discount,
      finalAmount: finalTotal,
      address,
      invoiceDate: new Date(),
      shoppingMethod: paymentMethod,
      status: 'Pending',
      createdOn: new Date(),
      couponStatus: !!couponId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      requestId,
    });

    if (couponId) {
      const couponData = await Coupon.findById(couponId);
      if (!couponData || !couponData.isList) {
     let res11=   await saveFailedOrder(userId, {
          address,
          orderItems,
          subtotal,
          discount,
          finalTotal,
          paymentMethod: 'Razorpay',
          failureReason: 'Invalid or unlisted coupon.',
          couponId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          requestId,
        });
        console.log('DEBUG saveFailedOrder [res11]', { input: { address, orderItems, subtotal, discount, finalTotal, paymentMethod: 'Razorpay', failureReason: 'Invalid or unlisted coupon.', couponId, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, requestId }, result: res11 });
        if(res11){
        console.log('res11')
      }
        return res.status(400).json({ success: false, message: 'Invalid or unlisted coupon.', orderId: null });
      }
      await User.findByIdAndUpdate(userId, { $push: { redeemedUser: couponId } });
    }

   let razorpayorder= await newOrder.save();
   if(razorpayorder){
    console.log('razorpayorder',razorpayorder)
   }
    for (const item of orderItems) {
      await Product.updateOne({ _id: item.productId }, { $inc: { quantity: -item.quantity } });
    }
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    console.log('Razorpay Payment: SUCCESS', { orderId: newOrder._id });
    return res.status(200).json({ success: true, orderId: newOrder._id });
  } catch (error) {
    console.log('Razorpay Payment: FAILED (Exception)');
    console.error('Error handling Razorpay payment success:', error);
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    const orderItems = cart && cart.items ? cart.items.map(item => ({
      productId: item.productId?._id || null,
      quantity: item.quantity || 0,
      price: item.price || 0,
      totalPrice: item.totalPrice || 0,
    })) : [];
  let res12=  await saveFailedOrder(req.session.user, {
      address: req.body.address || null,
      orderItems,
      subtotal: req.body.subtotal || 0,
      discount: req.body.discount || 0,
      finalTotal: req.body.totalPrice || 0,
      paymentMethod: 'Razorpay',
      failureReason: error.message || 'Internal server error.',
      couponId: req.body.couponId,
      razorpayOrderId: req.body.razorpay_order_id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      requestId: req.body.requestId,
    });
    console.log('DEBUG saveFailedOrder [res12]', { input: { address: req.body.address || null, orderItems, subtotal: req.body.subtotal || 0, discount: req.body.discount || 0, finalTotal: req.body.totalPrice || 0, paymentMethod: 'Razorpay', failureReason: error.message || 'Internal server error.', couponId: req.body.couponId, razorpayOrderId: req.body.razorpay_order_id, razorpayPaymentId: req.body.razorpay_payment_id, requestId: req.body.requestId }, result: res12 });
    return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.', error: error.message });
  }
};

const placeOrder = async (req, res) => {
  const userId = req.session.user;
  let productsToRestore = [];
  try {
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to place an order.' });
    }

    const { address, paymentMethod, couponId, requestId } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, message: 'Please select a shipping address.' });
    }
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required.' });
    }
    if (!['COD', 'Wallet'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method for this endpoint.' });
    }

    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    if (!cart || !cart.items || cart.items.length === 0) {
    let res13=  await saveFailedOrder(userId, {
        address,
        orderItems: [],
        subtotal: 0,
        discount: 0,
        finalTotal: 0,
        paymentMethod,
        failureReason: 'Cart is empty.',
        couponId,
        requestId,
      });
      console.log('DEBUG saveFailedOrder [res13]', { input: { address, orderItems: [], subtotal: 0, discount: 0, finalTotal: 0, paymentMethod, failureReason: 'Cart is empty.', couponId, requestId }, result: res13 });
      if(res13){
        console.log('res13')
      }
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    const { subtotal, discount, taxes, shipping, finalTotal, orderItems } = await calculatePriceDetails(userId, couponId);
    productsToRestore = orderItems.map(item => ({ productId: item.productId, quantity: item.quantity }));

    for (const item of orderItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
    //  let res14=   await saveFailedOrder(userId, {
    //       address,
    //       orderItems,
    //       subtotal,
    //       discount,
    //       finalTotal,
    //       paymentMethod,
    //       failureReason: `Product not found: ${item.productId}`,
    //       couponId,
    //       requestId,
    //     });
    //     if(res14){
    //       console.log('res14')
    //     }
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
      }

      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
      // let res15=  await saveFailedOrder(userId, {
      //     address,
      //     orderItems,
      //     subtotal,
      //     discount,
      //     finalTotal,
      //     paymentMethod,
      //     failureReason: `Invalid quantity for ${product.name}`,
      //     couponId,
      //     requestId,
      //   });
      //   if(res15){
      //   console.log('res15')
      //   }
        return res.status(400).json({ success: false, message: `Invalid quantity for ${product.name}` });
      }
      if (product.quantity < quantity) {
    //  let res16=   await saveFailedOrder(userId, {
    //       address,
    //       orderItems,
    //       subtotal,
    //       discount,
    //       finalTotal,
    //       paymentMethod,
    //       failureReason: `Insufficient stock for ${product.name}.`,
    //       couponId,
    //       requestId,
    //     });
    
        // if(res16){
        //   console.log('res16')
        // }
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}.` });
      }
    }

    if (paymentMethod === 'COD' && finalTotal > 1000) {
    // let res17=  await saveFailedOrder(userId, {
    //     address,
    //     orderItems,
    //     subtotal,
    //     discount,
    //     finalTotal,
    //     paymentMethod,
    //     failureReason: 'Cash on Delivery is not available for orders above ₹1000.',
    //     couponId,
    //     requestId,
      // });
      // if(res17){
      //   console.log('res17')
      // }
      return res.status(400).json({ success: false, message: 'Cash on Delivery is not available for orders above ₹1000.' });
    }

    const addressExists = await Address.findOne({ _id: address, userid: userId });
    if (!addressExists) {
    let res18=  await saveFailedOrder(userId, {
        address,
        orderItems,
        subtotal,
        discount,
        finalTotal,
        paymentMethod,
        failureReason: 'Invalid address selected.',
        couponId,
        requestId,
      });
      if(res18){
        console.log('res18')
      }
      return res.status(400).json({ success: false, message: 'Invalid address selected.' });
    }

    if (couponId) {
      const couponData = await Coupon.findById(couponId);
      if (!couponData || !couponData.isList) {
      // let res19=  await saveFailedOrder(userId, {
      //     address,
      //     orderItems,
      //     subtotal,
      //     discount,
      //     finalTotal,
      //     paymentMethod,
      //     failureReason: 'Invalid or unlisted coupon.',
      //     couponId,
      //     requestId,
      //   });
      //   if(res19){
      //   console.log('res19')
      //   }
        return res.status(400).json({ success: false, message: 'Invalid or unlisted coupon.' });
      }
      await User.findByIdAndUpdate(userId, { $push: { redeemedUser: couponId } });
    }
    if(paymentMethod=='Wallet'){
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
          return res.status(400).json({ success: false, message: 'Wallet not found.' });
      }

      if (wallet.balance < finalTotal) {
          return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
      }

      const newOrder = new Order({
          userId,
          orderItems: orderItems.map(item => ({
              product: item.productId,
              quantity: item.quantity,
              price: item.price,
              status: 'Pending',
          })),
          totalAmount: subtotal,
          discount,
          finalAmount: finalTotal,
          address,
          invoiceDate: new Date(),
          shoppingMethod: paymentMethod,
          status: 'Pending',
          createdOn: new Date(),
          couponStatus: !!couponId,
          requestId,
      });

      await newOrder.save();

      wallet.balance -= finalTotal;
      wallet.transactions.push({
          order: newOrder._id,
          description: `Order payment (Order ID: ${newOrder._id})`,
          amount: finalTotal,
          status: 'Pending',
          type: 'debit'
      });
      wallet.updatedAt = new Date();
      await wallet.save();

      for (const item of orderItems) {
          await Product.updateOne({ _id: item.productId }, { $inc: { quantity: -item.quantity } });
      }
      
      console.log('Order placed successfully (Wallet):', { orderId: newOrder._id });
      return res.status(200).json({ success: true, order: newOrder, orderId: newOrder._id });
    }

    const newOrder = new Order({
      userId,
      orderItems: orderItems.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        price: item.price,
        status: 'Pending',
      })),
      totalAmount: subtotal,
      discount,
      finalAmount: finalTotal,
      address,
      invoiceDate: new Date(),
      shoppingMethod: paymentMethod,
      status: 'Pending',
      createdOn: new Date(),
      couponStatus: !!couponId,
      requestId,
    });

    await newOrder.save();
    for (const item of orderItems) {
      await Product.updateOne({ _id: item.productId }, { $inc: { quantity: -item.quantity } });
    }
    await Cart.updateOne({ userId }, { $set: { items: [] } });

    console.log('Order placed successfully:', { orderId: newOrder._id });
    return res.status(200).json({ success: true, order: newOrder, orderId: newOrder._id });
  } catch (error) {
    console.error('Error placing order:', error);
    for (const product of productsToRestore) {
      await Product.updateOne({ _id: product.productId }, { $inc: { quantity: product.quantity } });
    }
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('items.productId');
    const orderItems = cart && cart.items ? cart.items.map(item => ({
      productId: item.productId?._id || null,
      quantity: item.quantity || 0,
      price: item.price || 0,
      totalPrice: item.totalPrice || 0,
    })) : [];
  let res1=  await saveFailedOrder(userId, {
      address: req.body.address || null,
      orderItems,
      subtotal: req.body.subtotal || 0,
      discount: req.body.discount || 0,
      finalTotal: req.body.finalTotal || 0,
      paymentMethod: req.body.paymentMethod || 'Unknown',
      failureReason: error.message || 'Internal server error during order placement.',
      couponId: req.body.couponId,
      requestId: req.body.requestId,
    });
    console.log('DEBUG saveFailedOrder [res1]', { input: { address: req.body.address || null, orderItems, subtotal: req.body.subtotal || 0, discount: req.body.discount || 0, finalTotal: req.body.finalTotal || 0, paymentMethod: req.body.paymentMethod || 'Unknown', failureReason: error.message || 'Internal server error during order placement.', couponId: req.body.couponId, requestId: req.body.requestId }, result: res1 });
    return res.status(500).json({ success: false, message: 'Internal server error.', orderId: null });
  }
};

const getPaymentMethods = async (req, res) => {
  const methods = {
    card: true,
    upi: true,
    netbanking: true,
    wallet: true,
    emi: true,
    paylater: true,
  };
  return res.status(200).json({ success: true, methods });
};

const orderSuccess = async (req, res) => {
  try {
    res.render('user/order-success', { user: req.session.user, currentPage: 'shop' });
  } catch (error) {
    console.error('Error loading order success:', error);
    res.status(500).render('error', { message: 'Internal Server Error' });
  }
};

const orderFailed = async (req, res) => {
  try {
    const errorMessage = req.query.message || 'Order placement failed.';
    const orderId = req.query.orderId || null; 
    res.render('user/order-failed', { user: req.session.user, currentPage: 'shop', errorMessage, orderId });
  } catch (error) {
    console.error('Error loading order failed:', error);
    res.status(500).render('error', { message: 'Internal Server Error' });
  }
};

const getUpdatedPriceDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponId } = req.body;
    const effectiveCouponId = couponId || null;

    const { subtotal, discount, taxes, shipping, finalTotal } = await calculatePriceDetails(userId, effectiveCouponId);

    req.session.coupon = effectiveCouponId;
    req.session.subtotal = subtotal;
    req.session.discount = discount;
    req.session.taxes = taxes;
    req.session.shipping = shipping;
    req.session.finalTotal = finalTotal;

    if (!effectiveCouponId) req.session.discount = 0;

    res.status(200).json({
      success: true,
      data: { subtotal, discount, taxes, shipping, finalTotal },
    });
  } catch (error) {
    console.error('Error fetching price details:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const markOrderFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'Failed' }, { new: true });
    if (!updatedOrder) return res.status(404).json({ success: false, message: 'Order not found.' });
    return res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error marking order as failed:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  addToCart,
  loadcart,
  updateCartItem,
  removeCartItem,
  loadcheckout,
  placeOrder,
  orderSuccess,
  handleRazorpayPaymentSuccess,
  saveFailedOrder: saveFailedOrderRoute,
  orderFailed,
  getUpdatedPriceDetails,
  markOrderFailed,
  getPaymentMethods,
  createRazorpayOrder,
};