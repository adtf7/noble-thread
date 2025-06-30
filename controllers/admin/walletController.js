const Wallet = require('../../models/walletSchema');

const loadwallet = async (req, res, next) => {
    try {
        const wallets = await Wallet.find({})
            .populate('user', 'name email phone')
            .populate('transactions.order', 'orderId').sort({createdAt:-1});
        
        const transactions = [];
        for (const wallet of wallets) {
            for (const transaction of wallet.transactions) {
                transactions.push({
                    _id: transaction._id,
                    transactionId: transaction._id.toString(),
                    date: transaction.date,
                    user: wallet.user,
                    type: transaction.type,
                    amount: transaction.amount,
                    description: transaction.description,
                    status: transaction.status,
                    order: transaction.order,
                });
            }
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const totalTransactions = transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const paginatedTransactions = transactions.slice(startIndex, endIndex);

      
        const transactionId = req.query.transactionId;
        let selectedTransaction = null;
        if (transactionId) {
            selectedTransaction = transactions.find(t => t.transactionId === transactionId);
            if (!selectedTransaction) {
                return res.status(404).render('error', { message: 'Transaction not found' });
            }
        }

        res.render('admin/wallet', {
            transactions: paginatedTransactions,
            selectedTransaction,
            currentPage: page,
            totalPages,
            totalTransactions,
            currentPageName: 'wallet',
        });
    } catch (error) {
        console.error('Wallet not loading:', error.message);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
    
};

module.exports = { loadwallet };