const mongoose = require('mongoose');

// Define the Wallet Schema
const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true,
        unique: true 
    },
    balance: {
        type: Number,
        default: 0, 
        min: 0 
    },
    transactions: [
        {
            order: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Order', 
                required: true
            },
            description: {
                type: String,
                required: true 
            },
            amount: {
                type: Number,
                required: true,
                min: 0 
            },
            date: {
                type: Date,
                default: Date.now 
            },
            status: {
                type: String,
                enum: ['pending', 'completed', 'failed'], 
                default: 'pending'
            },
            type: {
                type: String,
                enum: ['debit', 'credit'], 
                required: true,
              }
            
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now 
    },
    updatedAt: {
        type: Date,
        default: Date.now 
    }
});



const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;