const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(), 
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true 
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
      default: 'Pending'
    },
    returnReason: {
      type: String,
      default: ''
    },
    cancelReason: { 
      type: String,
      default: ''
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
    default: 'Pending'
  },
  shoppingMethod: {
    type: String,
    required: true,
    enum: ['COD', 'Razorpay', 'Wallet'],
    default: 'COD' 
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponStatus: {
    type: Boolean,
    default: false
  }
});
let order = mongoose.model('Order', orderSchema);
module.exports = order;