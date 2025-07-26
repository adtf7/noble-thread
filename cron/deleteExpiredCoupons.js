const Coupon = require("../models/couponSchema");
const Product = require("../models/productSchema");
const Offer = require("../models/offerSchema");
const Category = require("../models/categorySchema");

async function DeleteExpiredCoupon() {
  try {
    const now = new Date();
    const expiredCoupons = await Coupon.find({ expireOn: { $lt: now } });

    if (!expiredCoupons || expiredCoupons.length === 0) {
      console.log("No expired coupons found");
      return;
    }

    for (const coupon of expiredCoupons) {
      console.log(`Deleting expired coupon: ${coupon.name}`);
    }

    const result = await Coupon.deleteMany({ expireOn: { $lt: now } });
    console.log("deleted", result);
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} expired coupons.`);
    }
  } catch (err) {
    console.error("Error deleting expired coupons:", err);
  }
}

const changeProductOffer = async () => {
  try {
    const now = new Date();
    const expiredOffers = await Offer.find({ endDate: { $lt: now } });

    if (!expiredOffers || expiredOffers.length === 0) {
      console.log("No expired offers found");
      return;
    }

    for (const offer of expiredOffers) {
      await Offer.updateOne(
        { _id: offer._id },
        { $set: { discountPercentage: 0 } }
      );

      const products = await Product.find({ offer: offer._id });

      for (const product of products) {
        let productUpdate = await Product.updateOne(
          { _id: product._id },
          { $set: { salePrice: product.regularPrice, offer: null } }
        );
        console.log(`Updated product: ${product.productName}`);
        console.log(productUpdate);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
};

const changeCategoryOffer = async () => {
  try {
    const now = new Date();
    const expiredOffers = await Offer.find({
      type: "category",
      endDate: { $lt: now },
    });

    if (!expiredOffers || expiredOffers.length === 0) {
      console.log("No expired category offers found");
      return;
    }

    for (const offer of expiredOffers) {
      await Offer.updateOne(
        { _id: offer._id },
        { $set: { discountPercentage: 0 } }
      );

      const categories = await Category.find({ offer: offer._id });
      for (const category of categories) {
        let categoryUpdate = await Category.updateOne(
          { _id: category._id },
          { $set: { offer: null } }
        );
        console.log(`Updated category: ${category.name}`);
        console.log(categoryUpdate);
      }
    }
  } catch (error) {
    console.error("Error in changeCategoryOffer:", error.message);
  }
};

module.exports = {
  DeleteExpiredCoupon,
  changeProductOffer,
  changeCategoryOffer,
};
