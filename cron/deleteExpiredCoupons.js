const cron = require('node-cron');
const Coupon = require('../models/couponSchema');

function DeleteExpiredCoupon() {
        console.log('DeleteExpiredCoupon cron job scheduled!');
    cron.schedule('0 0 * * *', async () => {
        try {
            const now = new Date();
            const result = await Coupon.deleteMany({ expireOn: { $lt: now } });
            console.log('deleted',result)
            if (result.deletedCount > 0) {
                console.log(`Deleted ${result.deletedCount} expired coupons.`);
            }
        } catch (err) {
            console.error('Error deleting expired coupons:', err);
        }
    });
}

module.exports = DeleteExpiredCoupon;