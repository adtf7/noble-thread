let mongoose = require('mongoose');
let { Schema } = mongoose;

let userschema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: true,
        sparse:true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    Cart: {
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    },
    Wallet: {
        type: Number,
        default: 0
    },
    Wishlist: {
        type: Schema.Types.ObjectId,
        ref: 'Wishlist'
    },
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    
    createdOn: {
        type: Date,
        default: Date.now
    },referralCode: {
        type: String,
        //required:true
  },
    redeemed: {
        type: Boolean,
        //default:false
    },
    redeemedUser: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
       // required:true
    }],
    
    searchHistory: [{
       category:{
        type:Schema.Types.ObjectId,
        ref:'category'
       },
       brand:{
        type:String
       },
       searchOn:{
        type:Date,
        default:Date.now
       }

    }],
});

let user = mongoose.model('User', userschema);
module.exports=user
    