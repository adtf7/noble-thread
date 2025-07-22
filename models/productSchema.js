  const mongoose = require("mongoose");
  const { Schema } = mongoose;

  const productSchema = new Schema({
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId, 
      ref: "Category",
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    offer:
    {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Offer'
    },
    quantity: {
      type: Number,
      default: true,
      required: true 
    },
    color: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      required: true,
    },
    productImage: {
      type: [String],
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Available', 'Out of stock', 'Discontinued'],
      required: true,
      default: 'Available'
    }
  }, { timestamps: true });

  let product = mongoose.model("Product", productSchema);
  module.exports = product;