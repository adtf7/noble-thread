const mongoose = require('mongoose');
const { Schema } = mongoose;



const offerSchema = new mongoose.Schema({
    type:
   { 
    type: String,
     enum: ['product', 'category', 'referral'], 
     required: true
     },
    productId:
     { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product'
     }, 
    categoryId: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category'
     }, 
    discountPercentage: 
    { type: Number, 
        required: true, 
        min: 0, 
        max: 100 }, 
    startDate: 
    {
         type: Date,
         default: 
         Date.now }, 
    endDate: 
    { type: Date

     }, 
    isActive:
     { 
    type: Boolean, 
    default: true },
});


let offer = mongoose.model('Offer', offerSchema);
module.exports=offer