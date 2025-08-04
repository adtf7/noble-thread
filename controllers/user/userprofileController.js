const Product = require("../../models/productSchema");
const User = require("../../models/userschema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const wallet = require("../../models/walletSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
let Cart = require("../../models/cartSchema");
let mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
let env = require("dotenv").config();



const userProfile = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  try {
    let userId = req.session.user;
    let userdata = await User.findById(userId);
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    res.render("user/userprofile", {
      user: userdata,
      currentPage: "profile",
      cartcount,
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.redirect("/pagenotfound");
  }
};

let edituser = async (req, res) => {
  try {
    let { name, phone } = req.body;
    let userId = req.session.user;
    console.log("name", name);
    console.log("phone", phone);
    console.log("userId", userId);
    let userupdate = await User.findByIdAndUpdate(
      userId,
      { $set: { name: name, phone: phone } },
      { new: true }
    );
    if (userupdate) {
      return res.json({ success: true, message: "user updated successfully" });
    } else {
      return res.status(404).json({ error: "user not found" });
    }
  } catch (error) {
    console.error("Error profile editing:", error);
    res.redirect("/pagenotfound");
  }
};

let changepassword = async (req, res) => {
  try {
    res.render("user/changepassword");
  } catch (error) {
    console.error("Error change password:", error);
    res.redirect("/pagenotfound");
  }
};

let changenewpassword = async (req, res) => {
  try {
    let { password, confirmPassword } = req.body;
    let userId = req.session.user;

    if (!password || !confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords required" });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match." });
    }

    let hashedPassword = await bcrypt.hash(password, 10);
    let updated = await User.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    if (updated.modifiedCount > 0) {
      return res.json({ success: true, redirect: "/profile" });
    } else {
      return res.json({ success: false, message: "Failed to update password" });
    }
  } catch (error) {
    console.error("Error changing password:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error. Try again later." });
  }
};

let addressmanagement = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  try {
    let userId = req.session.user;
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    let userAddresses = await Address.find({ userid: userId });
    let user = await User.findById(userId);
    let addresscount = userAddresses.length;
    res.render("user/address", {
      currentPage: "addresses",
      addresses: userAddresses,
      user: user,
      cartcount,
      addresscount,
    });
  } catch (error) {
    console.error("Error retrieving address:", error);
    res.redirect("/pagenotfound");
  }
};

let addaddress = async (req, res) => {
  try {
    let userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    let { name, addressLine1, city, state, postalCode, Phone, landmark } =
      req.body;
    let userAddresses = await Address.find({ userid: userId });
    if (userAddresses.length >= 5) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Only 5 addresses can be added per user. If you need to add more, please remove one.",
        });
    }

    if (
      !name ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode ||
      !Phone ||
      !landmark
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields" });
    }

    const newAddress = new Address({
      userid: userId,
      address: [
        {
          name: name,
          addressType: addressLine1,
          city: city,
          state: state,
          pincode: postalCode,
          phone: Phone,
          landMark: landmark,
        },
      ],
    });

    await newAddress.save();

    return res.json({
      success: true,
      message: "Address saved successfully!",
      address: newAddress,
    });
  } catch (error) {
    console.error("Error saving address:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving address. Try again later.",
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
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    return res.json({
      success: true,
      address: addressDoc.address[0],
    });
  } catch (error) {
    console.error("Error fetching address details:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching address details. Try again later.",
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
    console.log("addressId:", addressId);

    let { name, addressLine1, city, state, postalCode, Phone, landmark } =
      req.body;

    if (
      !name ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode ||
      !Phone ||
      !landmark
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields" });
    }

    let updateResult = await Address.updateOne(
      { _id: addressId, userid: userId },
      {
        $set: {
          "address.0.name": name,
          "address.0.addressType": addressLine1,
          "address.0.city": city,
          "address.0.state": state,
          "address.0.pincode": postalCode,
          "address.0.phone": Phone,
          "address.0.landMark": landmark,
        },
      }
    );

    if (updateResult.modifiedCount > 0) {
      return res.json({
        success: true,
        message: "Address updated successfully!",
      });
    } else {
      return res
        .status(404)
        .json({
          success: false,
          message: "Address not found or no changes made.",
        });
    }
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating address. Try again later.",
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
    console.log("Deleting address with id:", addressId);

    let deleteResult = await Address.deleteOne({
      _id: addressId,
      userid: userId,
    });

    if (deleteResult.deletedCount > 0) {
      return res.json({
        success: true,
        message: "Address deleted successfully!",
      });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Address not found." });
    }
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting address. Try again later.",
    });
  }
};

let orderDetails = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  let userId = req.session.user;
  try {
    let user = await User.findById(userId);
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);
    let order;
    if (req.params.id) {
      order = await Order.findOne({ _id: req.params.id, userId: userId })
        .populate("orderItems.product")
        .populate("address");
    } else {
      let orders = await Order.find({ userId: userId })
        .sort({ createdOn: -1 })
        .populate("orderItems.product")
        .populate("address");
      order = orders.length > 0 ? orders[0] : null;
    }

    res.render("user/order-details", {
      order,
      currentPage: "orders",
      user,
      cartcount,
    });
  } catch (error) {
    console.error("Error retrieving order details:", error);
    res.redirect("/pagenotfound");
  }
};

let orderHistory = async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  let userId = req.session.user;

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    let user = await User.findById(userId);

    // Get total count of orders
    const totalOrders = await Order.countDocuments({ userId: userId });
    const totalPages = Math.ceil(totalOrders / limit);

    let orders = await Order.find({ userId: req.session.user })
      .sort({ createdOn: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("orderItems.product")
      .populate("address");

    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);

    res.render("user/order-history", {
      orders,
      user,
      currentPage: "orders",
      cartcount,
      totalPages,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error retrieving order history:", error);
    res.redirect("/pagenotfound");
  }
};
const returnOrder = async (req, res) => {
  try {
    const { orderId, itemId, returnReason } = req.body;
    const userId = req.session.user;

    if (!orderId || !itemId || !returnReason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order ID, item ID, and return reason are required.",
        });
    }

    let order = await Order.findOne({ _id: orderId, userId: userId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.orderItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the order." });
    }

    if (item.status !== "Delivered") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Only delivered items can be returned.",
        });
    }

    if (item.status === "Return Request" || item.status === "Returned") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Item is already requested for return or returned.",
        });
    }

    item.status = "Return Request";
    item.returnReason = returnReason;

    await order.save();
    return res.json({
      success: true,
      message:
        "Return request submitted successfully. Refund will be processed after approval.",
    });
  } catch (error) {
    console.error("Error submitting return request:", error);
    res
      .status(500)
      .json({
        success: false,
        message:
          "Server error while submitting return request. Try again later.",
      });
  }
};

const handleReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId, action } = req.body;

    if (!orderId || !itemId || !action) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order ID, item ID, and action are required.",
        });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.orderItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the order." });
    }

    if (item.status !== "Return Request") {
      return res
        .status(400)
        .json({
          success: false,
          message: "No return request found for this item.",
        });
    }

    if (action === "approve") {
      item.status = "Returned";
      const refundAmount = item.price * item.quantity;

      await Product.updateOne(
        { _id: item.product },
        { $inc: { quantity: item.quantity } }
      );

      await wallet.updateOne(
        { user: order.userId },
        {
          $inc: { balance: refundAmount },
          $set: {
            "transactions.$[elem].status": "completed",
          },
        },
        {
          arrayFilters: [
            {
              "elem.order": order._id,
              "elem.item": item._id,
              "elem.status": "pending",
            },
          ],
        }
      );
    } else if (action === "reject") {
      item.status = "Delivered";

      await wallet.updateOne(
        { user: order.userId },
        {
          $pull: {
            transactions: {
              order: order._id,
              item: item._id,
              status: "pending",
            },
          },
        }
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid action." });
    }

    await order.save();
    return res.json({
      success: true,
      message: `Return request ${action}d successfully.`,
    });
  } catch (error) {
    console.error("Error handling return request:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while handling return request. Try again later.",
      });
  }
};
const cancelorder = async (req, res) => {
  try {
    const { orderId, itemId, reason } = req.body;

    if (!orderId || !itemId || !reason) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Order ID, item ID, and reason are required.",
        });
    }

    const order = await Order.findById(orderId).populate("orderItems.product");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.orderItems.find((i) => i._id.toString() === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in the order." });
    }

    if (item.status !== "Pending" && item.status !== "Processing") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Item cannot be canceled at this stage.",
        });
    }

    if (item.status === "Cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Item is already canceled." });
    }

    let refundAmount = 0;
    if (order.shoppingMethod !== "COD") {
      refundAmount = item.price * item.quantity;
    }

    const updateFields = {
      "orderItems.$[item].status": "Cancelled",
      "orderItems.$[item].cancelReason": reason,
    };

    await Order.updateOne(
      { _id: orderId },
      { $set: updateFields },
      { arrayFilters: [{ "item._id": itemId }] }
    );

    await Product.updateOne(
      { _id: item.product._id },
      { $inc: { quantity: item.quantity } }
    );

    if (refundAmount > 0) {
      let cancel = await wallet.updateOne(
        { user: order.userId },
        {
          $inc: { balance: refundAmount },
          updatedAt: new Date(),
          $push: {
            transactions: {
              order: order._id,
              item: item._id,
              description: `Refund for canceling item in order #${order._id}`,
              amount: refundAmount,
              date: new Date(),
              status: "completed",
              type: "credit",
            },
          },
        },
        { upsert: true }
      );
      console.log(cancel);
    }

    return res.json({ success: true, message: "Item canceled successfully." });
  } catch (error) {
    console.error("Error handling item cancel request:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while handling cancel request.",
      });
  }
};

const loadwallet = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;

    const userdata = await User.findById(user);

    let walletdata = await wallet.findOne({ user: user }).populate({
      path: "transactions.order",
    });
    const cartcount = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(user) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$userId",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);

    if (!walletdata) {
      walletdata = new wallet({
        user: user,
        balance: 0,
        transactions: [],
      });
      await walletdata.save();
    }

    walletdata.transactions.sort((a, b) => b.date - a.date);

    const totalTransactions = walletdata.transactions.length;

    const totalPages = Math.ceil(totalTransactions / limit);

    const paginatedTransactions = walletdata.transactions.slice(
      (page - 1) * limit,
      page * limit
    );

    res.render("user/wallet", {
      user: userdata,
      wallet: walletdata,
      currentPage: "wallet",
      balance: walletdata.balance,
      transactions: paginatedTransactions,
      totalPages,
      page,
      limit,
      cartcount,
    });
  } catch (error) {
    console.error("Error on wallet:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error on wallet. Try again later.",
      });
  }
};
const razorpay = new Razorpay({
  key_id: process.env.RAZRON_KEY_ID ,
  key_secret:process.env.RAZRON_KEY_SECRET,
});

let createRazorpayOrd = async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: "order_rcptid_11",
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const walletsave = async (user, amount, description = "Added fund to wallet") => {
  try {
    const userData = await User.findById(user);
    if (!userData) {
      throw new Error("User not found");
    }

    let Wallet = await wallet.findOne({ user: user });
    if (!Wallet) {
      Wallet = new wallet({
        user: user,
        balance: 0,
      });
    }

    const amt = parseFloat(amount);
    userData.Wallet += amt;
    Wallet.balance += amt;

    Wallet.transactions.push({
      order: null, 
      description: description,
      amount: amt,
      status: "completed", 
      type: "credit", 
    });

    // Save both user and wallet
    const usersaved = await userData.save();
    const walletsaved = await Wallet.save();

    console.log("usersaved", usersaved);
    console.log("walletsaved", walletsaved);

    return { success: true, message: "Wallet balance and transaction updated successfully" };
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    throw new Error("Failed to update wallet balance");
  }
};

let verifypayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } =
    req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", "Nw9O0gxxhJwU0yGeA7pBM0oU")
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    await walletsave(req.session.user, amount);

    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: "Invalid signature" });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.session.user;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required." });
    }

    const order = await Order.findOne({ _id: orderId, userId })
      .populate("orderItems.product")
      .populate("address");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    if (
      !order.address ||
      !order.address.address ||
      order.address.address.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "No address found for this order." });
    }

    if (!order.orderItems.every((item) => item.product)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Some products not found for this order.",
        });
    }

    console.log("Address:", JSON.stringify(order.address, null, 2));

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${order.orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(20).text("Invoice", { align: "center", underline: true });
    doc.moveDown();

    const shippingAddress = order.address.address[0];

    doc.fontSize(12).text(`Order ID: ${order.orderId}`, { align: "left" });
    doc.text(`Order Date: ${order.createdOn.toDateString()}`, {
      align: "left",
    });
    doc.text(
      `Invoice Date: ${
        order.invoiceDate ? order.invoiceDate.toDateString() : "N/A"
      }`,
      { align: "left" }
    );
    doc.text(`Customer Name: ${shippingAddress.name || "N/A"}`, {
      align: "left",
    });
    doc.text(
      `Shipping Address: ${shippingAddress.addressType || ""}, ${
        shippingAddress.city || ""
      }, ${shippingAddress.state || ""}, ${shippingAddress.pincode || ""}`,
      { align: "left" }
    );
    doc.text(`Phone: ${shippingAddress.phone || "N/A"}`, { align: "left" });
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    const table = {
      x: 50,
      widths: {
        item: 250,
        quantity: 80,
        price: 80,
        total: 80,
      },
    };
    const tableTop = doc.y;

    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Item", table.x, tableTop, {
      width: table.widths.item,
      align: "left",
    });
    doc.text("Quantity", table.x + table.widths.item, tableTop, {
      width: table.widths.quantity,
      align: "right",
    });
    doc.text(
      "Price",
      table.x + table.widths.item + table.widths.quantity,
      tableTop,
      { width: table.widths.price, align: "right" }
    );
    doc.text(
      "Total",
      table.x + table.widths.item + table.widths.quantity + table.widths.price,
      tableTop,
      { width: table.widths.total, align: "right" }
    );
    doc.moveDown(0.5);

    doc
      .moveTo(table.x, doc.y)
      .lineTo(table.x + 490, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica");
    let itemTotal = 0;
    order.orderItems.forEach((item, index) => {
      const y = doc.y;
      const itemPrice = item.quantity * item.price;
      itemTotal += itemPrice;
      doc.text(
        `${index + 1}. ${item.product.productName || "Unknown Product"}`,
        table.x,
        y,
        { width: table.widths.item, align: "left" }
      );
      doc.text(`${item.quantity}`, table.x + table.widths.item, y, {
        width: table.widths.quantity,
        align: "right",
      });
      doc.text(
        `₹${item.price.toFixed(2)}`,
        table.x + table.widths.item + table.widths.quantity,
        y,
        { width: table.widths.price, align: "right" }
      );
      doc.text(
        `₹${itemPrice.toFixed(2)}`,
        table.x +
          table.widths.item +
          table.widths.quantity +
          table.widths.price,
        y,
        { width: table.widths.total, align: "right" }
      );
      doc.moveDown(0.5);
    });

    doc
      .moveTo(table.x, doc.y)
      .lineTo(table.x + 490, doc.y)
      .stroke(); 
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold");
    doc.text("Subtotal", table.x, doc.y, {
      width: table.widths.item + table.widths.quantity + table.widths.price,
      align: "right",
    });
    doc.text(
      `₹${itemTotal.toFixed(2)}`,
      table.x + table.widths.item + table.widths.quantity + table.widths.price,
      doc.y,
      { width: table.widths.total, align: "right" }
    );
    doc.moveDown(0.5);

    if (order.discount > 0) {
      doc.text("Discount", table.x, doc.y, {
        width: table.widths.item + table.widths.quantity + table.widths.price,
        align: "right",
      });
      doc.text(
        `₹${order.discount.toFixed(2)}`,
        table.x +
          table.widths.item +
          table.widths.quantity +
          table.widths.price,
        doc.y,
        { width: table.widths.total, align: "right" }
      );
      doc.moveDown(0.5);
    }
    doc.text("Final Amount", table.x, doc.y, {
      width: table.widths.item + table.widths.quantity + table.widths.price,
      align: "right",
    });
    doc.text(
      `₹${order.finalAmount.toFixed(2)}`,
      table.x + table.widths.item + table.widths.quantity + table.widths.price,
      doc.y,
      { width: table.widths.total, align: "right" }
    );
    doc.moveDown();

    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Thank you for shopping with us!", {
        align: "center",
        marginTop: 20,
      });

    doc.end();
  } catch (error) {
    console.error("Error generating invoice:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while generating invoice.",
      });
  }
};

const retryRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required." });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId,
      status: "Failed",
    }).populate("orderItems.product");

    if (!order) {
      return res.status(404).json({ success: false, message: "Failed order not found." });
    }

    const outOfStockItems = [];

    for (const item of order.orderItems) {
      const product = item.product;
      const requiredQty = item.quantity;

      if (!product || product.quantity === undefined) {
        outOfStockItems.push({ name: "Unknown Product", reason: "Product not found." });
        continue;
      }

      if (product.quantity < requiredQty) {
        outOfStockItems.push({
          name: product.name,
          available: product.stock,
          required: requiredQty,
        });
      }
    }

    if (outOfStockItems.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Some items are out of stock.",
        outOfStockItems,
      });
    }

    const amount = Math.round(order.finalAmount * 100);
    const shortOrderId = order._id.toString().slice(-8);
    const receipt = `retry_${shortOrderId}_${Date.now()}`.slice(0, 40);

    const options = {
      amount,
      currency: "INR",
      receipt,
    };

    const razorpayOrder = await razorpay.orders.create(options);
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      razorpayOrder,
      razorpayKey: process.env.RAZRON_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating retry Razorpay order:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating retry order.",
    });
  }
};

const retrywallet = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;
    const ObjectId = mongoose.Types.ObjectId;
    
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    let wallet = await Wallet.findOne({ user: new ObjectId(userId) });
    console.log('wallet',wallet)
    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      userId,
      status: 'Failed',
    }).populate('orderItems.product');

    if (!order) {
      return res.status(400).json({ success: false, message: 'Order not found or not eligible for retry' });
    }

    // Check product availability
    const outOfStockItems = [];
    for (const item of order.orderItems) {
      const product = item.product;
      const requiredQty = item.quantity;

      if (!product || product.quantity === undefined) {
        outOfStockItems.push({ name: 'Unknown Product', reason: 'Product not found' });
        continue;
      }

      if (product.quantity < requiredQty) {
        outOfStockItems.push({ name: product.productName, reason: `Only ${product.quantity} items available` });
      }
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some items are out of stock',
        outOfStockItems,
      });
    }

    // Find user and check wallet balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (wallet.balance < order.finalAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance.`,
      });
    }

    // Deduct amount from wallet
    wallet.balance -= order.finalAmount;
    wallet.transactions.forEach(or=>{
      or.order=orderId;
      or.description=`Order payment (Order ID:${orderId})`;
      or.amount=order.finalAmount;
     or.status="completed";
     or.type='debit'
    })
    await wallet.save();

    // Update order status
    order.status = 'Pending'; // Or appropriate status (e.g., 'Processing')
    order.orderItems.forEach(item => {
      if (item.status === 'Failed') {
        item.status = 'Pending';
        order.shoppingMethod='Wallet'
      }
    });
    await order.save();

    // Optionally, update product quantities
    for (const item of order.orderItems) {
      const product = item.product;
      product.quantity -= item.quantity;
      await product.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Payment successful using Wallet',
    });
  } catch (error) {
    console.error('Error in retrywallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

const reverifyPayment = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
    } = req.body;
    const userId = req.session.user;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Missing payment details." });
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      userId,
    }).populate("orderItems");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const generated_signature = crypto
      .createHmac("sha256", "Nw9O0gxxhJwU0yGeA7pBM0oU")
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Payment signature verification failed.",
        });
    }

    order.status = "Pending";
    order.razorpayPaymentId = razorpay_payment_id;
    order.paymentVerified = true;

    order.orderItems.forEach((item) => {
      item.status = "Pending";
    });

    let updated = await order.save();
    if (updated) {
      for (const item of order.orderItems) {
        try {
          await product.updateOne(
            { _id: item.product },
            { $inc: { quantity: -item.quantity } }
          );
        } catch (er) {
          console.log("error on stock updating retrypayment", er);
        }
      }
    }
    console.log("updated", updated);
    res.json({ success: true, message: "Payment verified and order updated." });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error during payment verification.",
      });
  }
};

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
  returnOrder,
  handleReturnRequest,
  cancelorder,
  loadwallet,
  createRazorpayOrd,
  verifypayment,
  downloadInvoice,
  retryRazorpayOrder,
  reverifyPayment,
  retrywallet
};
