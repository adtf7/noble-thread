let User=require('../../models/userschema')
let Product = require("../../models/productSchema");
let cart=require('../../models/cartSchema')
let Wishlist = require("../../models/wishlistSchema");
const mongoose = require('mongoose');
let Cart=require('../../models/cartSchema')

const loadwishlist = async (req, res) => {
  try {
      const userId = req.session.user;
      const cartcount = await Cart.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: '$items' }, 
        { $group: {
            _id: '$userId',
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: '$items.quantity' } 
          }
        }
      ]);

      const [userdata, wishlistdata] = await Promise.all([
          User.findById(userId),
          Wishlist.findOne({ userId: new mongoose.Types.ObjectId(userId) }).populate('products.productId')
      ]);

      return res.render('user/wishlist', {
          user: userdata,
          currentPage: '',
          cartcount,
          wishlistItems: wishlistdata || { products: [] } 
      });

  } catch (error) {
      console.error('Error loading wishlist:', error);
      res.status(500).send('Internal Server Error');
  }
};

const addwishlist = async (req, res) => {
  try {
      const userId = req.session.user;
      const productId = req.body.productId; 

      if (!userId || !productId) {
          return res.status(400).json({ success: false, message: 'Invalid request' });
      }

   
      const product = await Product.findById(productId);
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
      }


      let isexisted = await Wishlist.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          "products.productId": new mongoose.Types.ObjectId(productId), 
      });

      if (isexisted) {
          return res.status(400).json({ success: false, message: "Product already in wishlist" });
      }

      
      let wishlist = await Wishlist.findOne({ userId });

      if (!wishlist) {
          wishlist = new Wishlist({ userId, products: [] });
      }

      wishlist.products.push({ productId, addedOn: Date.now() });
      let savewish = await wishlist.save();

      console.log('Saved to wishlist:', savewish);
      return res.status(200).json({ success: true, message: 'Product added to wishlist' });
 
  } catch (error) {
      console.error('Error adding product to wishlist:', error);
      if (!res.headersSent) {
          return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
  }
};

  let removewishlist=async(req,res)=>{
  
    try {
      let userId = req.session.user;
      let productId = req.body; 
      console.log("product", productId);
      console.log("userId", userId);
      if (!userId || !productId) {
        return res.status(400).json({ success: false, message: "Invalid request" });
    }
  
    let updatedWishlist = await Wishlist.findOneAndUpdate(
      { userId }, 
      { $pull: { products: { productId: new mongoose.Types.ObjectId(productId) } } }, 
      { new: true } 
  );
  if (!updatedWishlist) {
    return res.status(404).json({ success: false, message: "Wishlist not found" });
}
res.json({ success: true, message: "Product removed from wishlist", wishlist: updatedWishlist });

    } catch (error) {
      console.error("Error removing from wishlist:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

const addtocartwishlist = async (req, res) => {
  try {
    let userId = req.session.user;
    let productId  = req.body;
     
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }


    userId = new mongoose.Types.ObjectId(userId);
    productId = new mongoose.Types.ObjectId(productId);


    const cartData = await cart.findOne({ userId });

    if (cartData && cartData.items.some(item => item.productId.equals(productId))) {
      return res.status(400).json({ success: false, message: "Product already in cart" });
    }


    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }


    if (cartData) {
      cartData.items.push({
        productId,
        quantity: 1,
        price: product.salePrice,
        totalPrice: product.salePrice
      });
      await cartData.save();
    } else {
      const newCart = new cart({
        userId,
        items: [{
          productId,
          quantity: 1,
          price: product.salePrice,
          totalPrice: product.salePrice
        }]
      });
      await newCart.save();
    }

    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    res.status(200).json({ success: true, message: "Product added to cart" });

  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


  
  
module.exports ={
    loadwishlist,
    addwishlist,
    removewishlist,
    addtocartwishlist
}